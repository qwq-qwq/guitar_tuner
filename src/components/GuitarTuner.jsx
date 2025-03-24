import React, { useState, useEffect, useRef } from 'react'
import { Music, Volume2, X, Check } from 'lucide-react'

// Standard guitar string frequencies (E2, A2, D3, G3, B3, E4)
const STANDARD_GUITAR_TUNING = [
    { note: 'E2', frequency: 82.41 },
    { note: 'A2', frequency: 110.00 },
    { note: 'D3', frequency: 146.83 },
    { note: 'G3', frequency: 196.00 },
    { note: 'B3', frequency: 246.94 },
    { note: 'E4', frequency: 329.63 },
]

const GuitarTuner = () => {
    const [selectedString, setSelectedString] = useState(0)
    const [listening, setListening] = useState(false)
    const [pitch, setPitch] = useState(0)
    const [detectionStatus, setDetectionStatus] = useState('waiting') // 'waiting', 'detecting', 'in-tune'
    const [errorMessage, setErrorMessage] = useState('')
    const [debugInfo, setDebugInfo] = useState('')

    const audioContextRef = useRef(null)
    const analyserRef = useRef(null)
    const sourceRef = useRef(null)
    const animationRef = useRef(null)

    // Handler to start the tuner
    const startListening = async () => {
        try {
            setErrorMessage('')
            setDebugInfo('Запрос доступа к микрофону...')
            setDetectionStatus('detecting')

            // Create audio context if it doesn't exist
            if (!audioContextRef.current) {
                setDebugInfo('Создание аудио контекста...')
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
            }

            // Request microphone access
            setDebugInfo('Ожидание разрешения на доступ к микрофону...')
            const stream = await navigator.mediaDevices
                .getUserMedia({
                    audio: {
                        echoCancellation: false,
                        autoGainControl: false,
                        noiseSuppression: false,
                        latency: 0,
                    },
                })
            setDebugInfo('Доступ к микрофону получен!')

            // Set up analyzer
            analyserRef.current = audioContextRef.current.createAnalyser()
            analyserRef.current.fftSize = 2048
            analyserRef.current.smoothingTimeConstant = 0.8

            // Connect microphone to analyzer
            sourceRef.current = audioContextRef.current
                .createMediaStreamSource(stream)
            sourceRef.current.connect(analyserRef.current)

            // Start analysis
            setListening(true)
            setDebugInfo('Анализ звука запущен...')
            detectPitch()
        } catch (error) {
            console.error('Error accessing microphone:', error)
            setErrorMessage(
                'Не удалось получить доступ к микрофону: ' +
                `${error.message || error}. ` +
                'Пожалуйста, разрешите доступ и попробуйте снова.',
            )
            setDebugInfo(`Ошибка: ${error.message || error}`)
            setDetectionStatus('waiting')
        }
    }

    // Stop listening
    const stopListening = () => {
        if (sourceRef.current) {
            sourceRef.current.disconnect()
            sourceRef.current = null
        }

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
            animationRef.current = null
        }

        setListening(false)
        setPitch(0)
        setDetectionStatus('waiting')
        setDebugInfo('Анализ звука остановлен.')
    }

    // Improved pitch detection using YIN algorithm
    const findPitch = (buffer, sampleRate) => {
    // Implementation of a simplified YIN algorithm
        const bufferSize = buffer.length
        const threshold = 0.2

        // Step 1: Calculate the difference function
        const yinBuffer = new Float32Array(bufferSize / 2)

        // Initialize with 1 to avoid potential division by zero later
        yinBuffer[0] = 1

        // Step 2: Calculate the squared difference for each tau
        for (let tau = 1; tau < yinBuffer.length; tau++) {
            // Direct implementation of the YIN difference function
            let sum = 0
            for (let i = 0; i < yinBuffer.length; i++) {
                const delta = buffer[i] - buffer[i + tau]
                sum += delta * delta
            }
            yinBuffer[tau] = sum
        }

        // Step 3: Cumulative normalization
        let runningSum = 0
        for (let tau = 1; tau < yinBuffer.length; tau++) {
            runningSum += yinBuffer[tau]
            if (runningSum === 0) {
                yinBuffer[tau] = 1
            } else {
                yinBuffer[tau] = yinBuffer[tau] * tau / runningSum
            }
        }

        // Step 4: Find the first minimum below the threshold
        let minTau = 0
        let minValue = 1000 // Start with a high value

        // Search for the first dip below the threshold
        for (let tau = 2; tau < yinBuffer.length; tau++) {
            if (yinBuffer[tau] < threshold && yinBuffer[tau] < yinBuffer[tau - 1]
                && yinBuffer[tau] < yinBuffer[tau + 1]) {
                minTau = tau
                minValue = yinBuffer[tau]
                break
            }
        }

        // If no pitch found, search for the overall minimum
        if (minTau === 0) {
            for (let tau = 2; tau < yinBuffer.length; tau++) {
                if (yinBuffer[tau] < minValue && yinBuffer[tau] < yinBuffer[tau - 1]
                    && yinBuffer[tau] < yinBuffer[tau + 1]) {
                    minTau = tau
                    minValue = yinBuffer[tau]
                }
            }
        }

        // Check if a minimum was found
        if (minTau === 0) {
            return -1 // No pitch detected
        }

        // Step 5: Parabolic Interpolation for better accuracy
        let betterTau
        const x0 = minTau - 1
        const x1 = minTau
        const x2 = minTau + 1
        const y0 = yinBuffer[x0]
        const y1 = yinBuffer[x1]
        const y2 = yinBuffer[x2]

        // Use quadratic interpolation to find the exact minimum
        const d = (y2 - y0) / (2 * (2 * y1 - y2 - y0))
        betterTau = x1 + d

        // Convert to frequency in Hz
        const frequency = sampleRate / betterTau

        // Sanity check - reject too low or too high frequencies
        if (frequency < 70 || frequency > 600) {
            return -1
        }

        return frequency
    }

    // Main pitch detection function
    const detectPitch = () => {
        try {
            const analyser = analyserRef.current
            const buffer = new Float32Array(analyser.fftSize)
            analyser.getFloatTimeDomainData(buffer)

            // Calculate RMS to check if there's significant sound
            let rms = 0
            for (let i = 0; i < buffer.length; i++) {
                rms += buffer[i] * buffer[i]
            }
            rms = Math.sqrt(rms / buffer.length)

            // Only proceed if the sound is loud enough
            if (rms < 0.005) {
                setDebugInfo(`Too quiet... (${rms.toFixed(4)})`)
                animationRef.current = requestAnimationFrame(detectPitch)
                return
            }

            const sampleRate = audioContextRef.current.sampleRate
            const detectedPitch = findPitch(buffer, sampleRate)

            if (detectedPitch !== -1) {
                setPitch(detectedPitch)

                // Автоопределение струны
                const closestStringIndex = findClosestString(detectedPitch)
                setSelectedString(closestStringIndex)

                // Check how close we are to the target
                const targetFrequency = STANDARD_GUITAR_TUNING[closestStringIndex].frequency
                const centDifference = 1200 * Math.log2(detectedPitch / targetFrequency)

                if (Math.abs(centDifference) < 10) {
                    setDetectionStatus('in-tune')
                    setDebugInfo(`In tune! (${centDifference.toFixed(2)} cents)`)
                } else {
                    setDetectionStatus('detecting')
                    setDebugInfo(
                        `Frequency: ${detectedPitch.toFixed(2)} Hz | ` +
                        `Difference: ${centDifference.toFixed(2)} cents`,
                    )
                }
            } else {
                setDebugInfo(`Unable to determine frequency | Volume: ${rms.toFixed(4)}`)
            }

            animationRef.current = requestAnimationFrame(detectPitch)
        } catch (error) {
            console.error('Error in detectPitch:', error)
            setDebugInfo(`Error in analysis: ${error.message || error}`)
            setErrorMessage(`Error analyzing sound: ${error.message || error}`)
            stopListening()
        }
    }

    // Cleanup when unmounting
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close()
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [])

    // Calculate the difference between detected pitch and target
    const getPitchDifference = () => {
        if (pitch <= 0) return 0

        const targetFrequency = STANDARD_GUITAR_TUNING[selectedString].frequency
        return pitch - targetFrequency
    }

    // Find the closest string to the detected frequency
    const findClosestString = (frequency) => {
        if (frequency <= 0) return selectedString

        let closestIndex = 0
        let minDifference = Infinity

        STANDARD_GUITAR_TUNING.forEach((string, index) => {
            const difference = Math.abs(frequency - string.frequency)
            if (difference < minDifference) {
                minDifference = difference
                closestIndex = index
            }
        })

        return closestIndex
    }

    // Get arrow for displaying a tuning direction
    const getTuningDirection = () => {
        const difference = getPitchDifference()

        if (Math.abs(difference) < 2) return 'in tune'
        return difference > 0 ? 'lower' : 'raise'
    }

    // Calculate percentage for indicator
    const getTuningPercentage = () => {
        if (pitch <= 0) return 0.5 // Center by default

        const targetFrequency = STANDARD_GUITAR_TUNING[selectedString].frequency
        const centDifference = 1200 * Math.log2(pitch / targetFrequency)

        // Limit values in range from -50 to +50 cents
        const clampedDifference = Math.max(-50, Math.min(50, centDifference))
        // Convert to percentage (-50 = 0%, 0 = 50%, +50 = 100%)
        return (clampedDifference + 50) / 100
    }

    return (
        <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg shadow w-full max-w-md mx-auto">
            <div className="flex items-center justify-center mb-6">
                <Music className="text-blue-500 mr-2" />
                <h1 className="text-2xl font-bold text-gray-600">Guitar Tuner</h1>
            </div>

            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 w-full">
                    {errorMessage}
                </div>
            )}

            <div className="w-full mb-6">
                <div className="grid grid-cols-6 gap-1">
                    {STANDARD_GUITAR_TUNING.map((string, index) => (
                        <button
                            key={index}
                            className={`p-3 rounded transition-colors duration-200 ${
                                selectedString === index
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            onClick={() => setSelectedString(index)}
                        >
                            {string.note}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-100 min-h-[240px]">
                <div className="text-center mb-4">
                    <span className="text-lg font-semibold text-gray-600">
                        String: {STANDARD_GUITAR_TUNING[selectedString].note} (
                        {STANDARD_GUITAR_TUNING[selectedString]
                            .frequency
                            .toFixed(2)} Hz)
                    </span>
                </div>

                {pitch > 0 && (
                    <div className="text-center mb-4">
                        <span className="text-xl font-medium text-gray-600">
                            {pitch.toFixed(2)} Hz
                        </span>
                    </div>
                )}

                {listening && pitch > 0 && (
                    <div className="relative w-full flex flex-col items-center space-y-8">
                        {/* Frequency visualization */}
                        <div className="relative w-full">
                            {/* Scale background */}
                            <div className="w-full h-3 bg-gray-100 rounded-full relative">
                                {/* Target frequency marker */}
                                <div className="absolute w-0.5 h-5 bg-green-500 left-1/2 top-1/2 -translate-y-1/2 transform -translate-x-1/2"></div>
                                
                                {/* Current frequency indicator */}
                                <div 
                                    className={`absolute w-8 h-8 -top-3 transition-all duration-300 flex items-center justify-center`}
                                    style={{
                                        left: `${getTuningPercentage() * 100}%`,
                                        transform: 'translateX(-50%)'
                                    }}
                                >
                                    <div className={`w-4 h-4 transform rotate-45 ${
                                        detectionStatus === 'in-tune' 
                                            ? 'bg-green-500' 
                                            : 'bg-blue-500'
                                    }`}></div>
                                </div>
                            </div>

                            {/* Frequency labels */}
                            <div className="absolute w-full flex justify-between px-2 mt-2">
                                <span className="text-sm text-gray-500">
                                    {Math.round(STANDARD_GUITAR_TUNING[selectedString].frequency * 0.8)} Hz
                                </span>
                                <span className="text-sm text-gray-500">
                                    {Math.round(STANDARD_GUITAR_TUNING[selectedString].frequency)} Hz
                                </span>
                                <span className="text-sm text-gray-500">
                                    {Math.round(STANDARD_GUITAR_TUNING[selectedString].frequency * 1.2)} Hz
                                </span>
                            </div>
                        </div>

                        {/* Debug info with better styling */}
                        {debugInfo && (
                            <div className="text-center mt-6">
                                <p className="text-base text-gray-600">
                                    {/* {debugInfo} */}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {detectionStatus === 'in-tune' && (
                    <div className="flex justify-center mt-4">
                        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full flex items-center animate-pulse">
                            <Check className="mr-1" /> In tune!
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full flex justify-center">
                {!listening ? (
                    <button
                        className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-full
                        flex items-center justify-center shadow-md w-64 transition-colors duration-200"
                        onClick={startListening}
                    >
                        <Volume2 className="mr-2" /> Start tuning
                    </button>
                ) : (
                    <button
                        className="bg-red-500 hover:bg-red-600 text-white px-8
                        py-4 rounded-full flex items-center justify-center shadow-md w-64 transition-colors duration-200"
                        onClick={stopListening}
                    >
                        <X className="mr-2" /> Stop tuning
                    </button>
                )}
            </div>
        </div>
    )
}

export default GuitarTuner
