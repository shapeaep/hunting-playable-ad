import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { base64JS } from '../assets/base64JS.js';
import { BASE64WASM } from '../assets/base64Wasm.js';

// Helper function to decode base64 to Uint8Array
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Create Blob URLs for Draco files from base64 (created once at module load)
const wasmBytes = base64ToUint8Array(BASE64WASM);
const wasmBlob = new Blob([wasmBytes], { type: 'application/wasm' });
const wasmBlobURL = URL.createObjectURL(wasmBlob);

const jsBytes = base64ToUint8Array(base64JS);
const jsBlob = new Blob([jsBytes], { type: 'application/javascript' });
const jsBlobURL = URL.createObjectURL(jsBlob);

/**
 * Creates a configured DRACOLoader with blob URLs for embedded Draco decoder
 * @returns {DRACOLoader} Configured DRACOLoader instance
 */
export function createDracoLoader() {
    // Create LoadingManager with URL modifier to intercept Draco file requests
    const manager = new THREE.LoadingManager();
    
    // Intercept requests for Draco files and replace with Blob URLs
    manager.setURLModifier((url) => {
        if (url.includes('draco_decoder.wasm')) 
            return wasmBlobURL;
        if (url.includes('draco_wasm_wrapper.js')) 
            return jsBlobURL;
        return url;
    });
    
    // Set up DRACOLoader with the custom manager
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('draco/'); // Virtual path, intercepted by LoadingManager
    
    return dracoLoader;
}



