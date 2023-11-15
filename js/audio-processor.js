// audio-processor.js
class SilenceDetectorProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{ name: 'threshold', defaultValue: 0.1 }];
    }

    constructor() {
        super();
        this.silenceStart = performance.now();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const threshold = parameters.threshold;
        let isSilent = true;

        for (let channel = 0; channel < input.length; channel++) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            for (let i = 0; i < inputChannel.length; i++) {
                if (Math.abs(inputChannel[i]) > threshold[0]) {
                    isSilent = false;
                    this.silenceStart = performance.now();
                }
                outputChannel[i] = inputChannel[i]; // Passthrough
            }
        }

        if (performance.now() - this.silenceStart > 3000) { // 3 seconds of silence
            this.port.postMessage('silence');
        }

        return isSilent;
    }
}

registerProcessor('silence-detector-processor', SilenceDetectorProcessor);
