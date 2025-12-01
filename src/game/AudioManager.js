import { CONFIG } from '../config';

/**
 * Audio manager for game sounds - generates sounds procedurally using Web Audio API
 */
export class AudioManager {
    constructor() {
        this.enabled = CONFIG.audio?.enabled !== false;
        this.ambientVolume = CONFIG.audio?.ambientVolume ?? 0.3;
        this.sfxVolume = CONFIG.audio?.sfxVolume ?? 0.7;
        
        this.context = null;
        this.ambientSource = null;
        this.isAmbientPlaying = false;
        
        // Lazy init on first user interaction
        this.initialized = false;
    }
    
    /**
     * Initialize audio context (must be called after user interaction)
     */
    init() {
        if (this.initialized || !this.enabled) return;
        
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }
    
    /**
     * Resume audio context if suspended
     */
    async resume() {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }
    
    /**
     * Play rifle gunshot sound effect
     */
    playGunshot() {
        if (!this.enabled || !this.initialized) return;
        this.resume();
        
        const ctx = this.context;
        const now = ctx.currentTime;
        
        // Rifle shot characteristics:
        // 1. Sharp supersonic crack (very fast attack)
        // 2. Muzzle blast (low frequency boom)
        // 3. Mechanical action sound
        // 4. Distance echo
        
        // Master output with compression effect
        const outputGain = ctx.createGain();
        outputGain.gain.value = this.sfxVolume * 1.2;
        
        // Add waveshaper for slight distortion/punch
        const distortion = ctx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(8);
        distortion.oversample = '2x';
        
        outputGain.connect(distortion);
        distortion.connect(this.masterGain);
        
        // === 1. SUPERSONIC CRACK (sharp high-frequency transient) ===
        const crackDuration = 0.025;
        const crackBuffer = ctx.createBuffer(1, ctx.sampleRate * crackDuration, ctx.sampleRate);
        const crackData = crackBuffer.getChannelData(0);
        
        for (let i = 0; i < crackData.length; i++) {
            const t = i / ctx.sampleRate;
            // Very fast exponential decay with white noise
            const envelope = Math.exp(-t * 200);
            // Mix of noise and impulse
            const noise = Math.random() * 2 - 1;
            const impulse = i < 5 ? 1 : 0;
            crackData[i] = (noise * 0.7 + impulse * 0.3) * envelope;
        }
        
        const crackSource = ctx.createBufferSource();
        crackSource.buffer = crackBuffer;
        
        // High-pass to keep it crisp
        const crackHighpass = ctx.createBiquadFilter();
        crackHighpass.type = 'highpass';
        crackHighpass.frequency.value = 2000;
        
        const crackGain = ctx.createGain();
        crackGain.gain.value = 0.9;
        
        crackSource.connect(crackHighpass);
        crackHighpass.connect(crackGain);
        crackGain.connect(outputGain);
        crackSource.start(now);
        
        // === 2. MUZZLE BLAST (low frequency boom) ===
        const blastDuration = 0.12;
        const blastBuffer = ctx.createBuffer(1, ctx.sampleRate * blastDuration, ctx.sampleRate);
        const blastData = blastBuffer.getChannelData(0);
        
        for (let i = 0; i < blastData.length; i++) {
            const t = i / ctx.sampleRate;
            // Fast attack, medium decay
            const envelope = Math.exp(-t * 25) * (1 - Math.exp(-t * 500));
            // Low frequency rumble with noise
            const lowFreq = Math.sin(t * 80 * Math.PI * 2) * 0.6;
            const noise = (Math.random() * 2 - 1) * 0.4;
            blastData[i] = (lowFreq + noise) * envelope;
        }
        
        const blastSource = ctx.createBufferSource();
        blastSource.buffer = blastBuffer;
        
        // Lowpass to emphasize bass
        const blastLowpass = ctx.createBiquadFilter();
        blastLowpass.type = 'lowpass';
        blastLowpass.frequency.value = 400;
        blastLowpass.Q.value = 1;
        
        const blastGain = ctx.createGain();
        blastGain.gain.value = 1.0;
        
        blastSource.connect(blastLowpass);
        blastLowpass.connect(blastGain);
        blastGain.connect(outputGain);
        blastSource.start(now);
        
        // === 3. MID-RANGE PUNCH (body of the shot) ===
        const punchDuration = 0.08;
        const punchBuffer = ctx.createBuffer(1, ctx.sampleRate * punchDuration, ctx.sampleRate);
        const punchData = punchBuffer.getChannelData(0);
        
        for (let i = 0; i < punchData.length; i++) {
            const t = i / ctx.sampleRate;
            // Sharp attack, quick decay
            const envelope = Math.exp(-t * 50) * (1 - Math.exp(-t * 1000));
            const noise = Math.random() * 2 - 1;
            punchData[i] = noise * envelope;
        }
        
        const punchSource = ctx.createBufferSource();
        punchSource.buffer = punchBuffer;
        
        // Bandpass for mid-range
        const punchBandpass = ctx.createBiquadFilter();
        punchBandpass.type = 'bandpass';
        punchBandpass.frequency.value = 800;
        punchBandpass.Q.value = 0.7;
        
        const punchGain = ctx.createGain();
        punchGain.gain.value = 0.7;
        
        punchSource.connect(punchBandpass);
        punchBandpass.connect(punchGain);
        punchGain.connect(outputGain);
        punchSource.start(now);
        
        // === 4. MECHANICAL CLICK (bolt action) ===
        const clickOsc = ctx.createOscillator();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(4000, now + 0.002);
        clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.015);
        
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0, now);
        clickGain.gain.linearRampToValueAtTime(0.25, now + 0.002);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        
        clickOsc.connect(clickGain);
        clickGain.connect(outputGain);
        clickOsc.start(now);
        clickOsc.stop(now + 0.02);
        
        // === 5. DISTANT ECHO (environmental reverb) ===
        const echoDelays = [120, 250, 400];
        echoDelays.forEach((delayMs, idx) => {
            setTimeout(() => {
                if (!this.context) return;
                
                const echoDuration = 0.15 - idx * 0.03;
                const echoBuffer = ctx.createBuffer(1, ctx.sampleRate * echoDuration, ctx.sampleRate);
                const echoData = echoBuffer.getChannelData(0);
                
                for (let i = 0; i < echoData.length; i++) {
                    const t = i / ctx.sampleRate;
                    const envelope = Math.exp(-t * (15 + idx * 5));
                    echoData[i] = (Math.random() * 2 - 1) * envelope;
                }
                
                const echoSource = ctx.createBufferSource();
                echoSource.buffer = echoBuffer;
                
                // More filtering for distant echoes
                const echoFilter = ctx.createBiquadFilter();
                echoFilter.type = 'lowpass';
                echoFilter.frequency.value = 1500 - idx * 400;
                
                const echoGain = ctx.createGain();
                echoGain.gain.value = (0.2 - idx * 0.05) * this.sfxVolume;
                
                echoSource.connect(echoFilter);
                echoFilter.connect(echoGain);
                echoGain.connect(this.masterGain);
                echoSource.start();
            }, delayMs);
        });
    }
    
    /**
     * Create distortion curve for waveshaper
     */
    makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }
    
    /**
     * Start ambient forest sound (loop)
     */
    startAmbient() {
        if (!this.enabled || !this.initialized || this.isAmbientPlaying) return;
        this.resume();
        
        this.isAmbientPlaying = true;
        this.playAmbientLoop();
    }
    
    /**
     * Generate and play ambient forest sounds
     */
    playAmbientLoop() {
        if (!this.isAmbientPlaying || !this.context) return;
        
        const ctx = this.context;
        const now = ctx.currentTime;
        
        // Ambient gain
        const ambientGain = ctx.createGain();
        ambientGain.gain.value = this.ambientVolume * 0.5;
        ambientGain.connect(this.masterGain);
        
        // === Wind/rustling leaves (filtered noise) ===
        const windDuration = 4;
        const windBuffer = ctx.createBuffer(1, ctx.sampleRate * windDuration, ctx.sampleRate);
        const windData = windBuffer.getChannelData(0);
        
        // Generate wind-like noise with slow modulation
        let noiseVal = 0;
        for (let i = 0; i < windData.length; i++) {
            // Brownian noise (more natural wind sound)
            noiseVal += (Math.random() * 2 - 1) * 0.05;
            noiseVal *= 0.998; // Decay
            
            // Slow amplitude modulation
            const mod = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(i / ctx.sampleRate * 0.3 * Math.PI * 2));
            windData[i] = noiseVal * mod;
        }
        
        const windSource = ctx.createBufferSource();
        windSource.buffer = windBuffer;
        
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 400 + Math.random() * 200;
        windFilter.Q.value = 0.5;
        
        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0, now);
        windGain.gain.linearRampToValueAtTime(0.4, now + 0.5);
        windGain.gain.linearRampToValueAtTime(0.3, now + windDuration - 0.5);
        windGain.gain.linearRampToValueAtTime(0, now + windDuration);
        
        windSource.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(ambientGain);
        windSource.start(now);
        
        // === Random bird chirp ===
        if (Math.random() < 0.4) {
            const birdDelay = Math.random() * 2;
            this.playBirdChirp(now + birdDelay, ambientGain);
        }
        
        // === Another bird ===
        if (Math.random() < 0.3) {
            const birdDelay = 1.5 + Math.random() * 2;
            this.playBirdChirp(now + birdDelay, ambientGain, 1.2 + Math.random() * 0.4);
        }
        
        // Schedule next loop
        setTimeout(() => {
            this.playAmbientLoop();
        }, (windDuration - 0.5) * 1000);
    }
    
    /**
     * Play a bird chirp sound
     */
    playBirdChirp(startTime, outputNode, pitchMult = 1) {
        const ctx = this.context;
        
        // Bird chirp is multiple short frequency sweeps
        const chirpCount = 2 + Math.floor(Math.random() * 3);
        const baseFreq = (1800 + Math.random() * 800) * pitchMult;
        
        for (let c = 0; c < chirpCount; c++) {
            const chirpStart = startTime + c * 0.12;
            const chirpDuration = 0.06 + Math.random() * 0.04;
            
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq * (0.9 + Math.random() * 0.2), chirpStart);
            osc.frequency.exponentialRampToValueAtTime(
                baseFreq * (0.7 + Math.random() * 0.3), 
                chirpStart + chirpDuration
            );
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, chirpStart);
            gain.gain.linearRampToValueAtTime(0.15, chirpStart + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, chirpStart + chirpDuration);
            
            osc.connect(gain);
            gain.connect(outputNode);
            osc.start(chirpStart);
            osc.stop(chirpStart + chirpDuration);
        }
    }
    
    /**
     * Stop ambient sounds
     */
    stopAmbient() {
        this.isAmbientPlaying = false;
    }
    
    /**
     * Set master volume
     */
    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    
    /**
     * Cleanup
     */
    dispose() {
        this.stopAmbient();
        if (this.context) {
            this.context.close();
            this.context = null;
        }
    }
}

