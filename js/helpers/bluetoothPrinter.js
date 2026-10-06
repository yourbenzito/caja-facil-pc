const BluetoothPrinter = {
    // Verificar disponibilidad del adaptador Bluetooth
    async getAvailability() {
        if (!navigator.bluetooth) return false;
        try {
            return await navigator.bluetooth.getAvailability();
        } catch (e) {
            console.error("[Bluetooth] Error al verificar Bluetooth:", e);
            return false;
        }
    },

    // Buscar y emparejar un dispositivo
    async pairDevice() {
        if (!navigator.bluetooth) {
            throw new Error("El Bluetooth no es soportado por este navegador/plataforma.");
        }

        const optionalServices = [
            '000018f0-0000-1000-8000-00805f9b34fb', // Generic Printer
            '0000e0e1-0000-1000-8000-00805f9b34fb', // Common printer BLE
            '000018f1-0000-1000-8000-00805f9b34fb',
            '0000180a-0000-1000-8000-00805f9b34fb'  // Device Info
        ];

        console.log("[Bluetooth] Iniciando escaneo...");
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: optionalServices
        });

        if (device) {
            localStorage.setItem('bluetoothPrinterId', device.id);
            localStorage.setItem('bluetoothPrinterName', device.name || 'Impresora Bluetooth');
            console.log(`[Bluetooth] Dispositivo emparejado: ${device.name} (${device.id})`);
            return device;
        }
        return null;
    },

    // Obtener dispositivo guardado previamente
    async getSavedDevice() {
        const savedId = localStorage.getItem('bluetoothPrinterId');
        if (!savedId) return null;

        if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return null;
        try {
            const devices = await navigator.bluetooth.getDevices();
            const device = devices.find(d => d.id === savedId);
            if (device) return device;
        } catch (e) {
            console.error("[Bluetooth] Error al buscar dispositivo guardado:", e);
        }
        return null;
    },

    // Limpiar configuración
    forgetDevice() {
        localStorage.removeItem('bluetoothPrinterId');
        localStorage.removeItem('bluetoothPrinterName');
    },

    // Formatear texto limpio sin acentos para evitar problemas de codificación de impresora
    cleanText(text) {
        const replacements = {
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
            'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
            'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
        };
        return text.split('').map(char => replacements[char] || char).join('');
    },

    // Enviar impresión por Bluetooth
    async print(text, options = {}) {
        const savedId = localStorage.getItem('bluetoothPrinterId');
        if (!savedId) {
            throw new Error("No hay ninguna impresora Bluetooth vinculada. Por favor, vincúlala en Configuración.");
        }

        let device = await this.getSavedDevice();
        if (!device) {
            console.log("[Bluetooth] Impresora guardada no encontrada en sesión, solicitando emparejamiento...");
            device = await this.pairDevice();
        }

        if (!device) throw new Error("No se pudo conectar a la impresora.");

        console.log("[Bluetooth] Conectando a GATT...");
        const server = await device.gatt.connect();

        // Lista de posibles UUIDs de servicios de impresión a buscar
        const serviceUUIDs = [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '0000e0e1-0000-1000-8000-00805f9b34fb',
            '000018f1-0000-1000-8000-00805f9b34fb'
        ];

        let service = null;
        for (const uuid of serviceUUIDs) {
            try {
                service = await server.getPrimaryService(uuid);
                if (service) break;
            } catch (e) {
                // Continuar buscando
            }
        }

        if (!service) {
            // Intentar recuperar el primer servicio disponible
            try {
                const services = await server.getPrimaryServices();
                if (services.length > 0) service = services[0];
            } catch (e) {}
        }

        if (!service) {
            throw new Error("Servicio de impresión no detectado en el dispositivo Bluetooth.");
        }

        console.log("[Bluetooth] Obteniendo características...");
        const characteristics = await service.getCharacteristics();
        // Buscar la característica que permita escritura
        const writeChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

        if (!writeChar) {
            throw new Error("No se encontró canal de escritura de datos en la impresora.");
        }

        console.log("[Bluetooth] Canal de escritura listo. Preparando comandos ESC/POS...");

        // Formar el buffer de comandos de impresión
        const commands = [];
        
        // 1. Inicializar impresora (ESC @)
        commands.push(0x1B, 0x40);

        // 2. Formatear y añadir texto
        const cleanedText = this.cleanText(text);
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(cleanedText);
        
        for (const byte of textBytes) {
            commands.push(byte);
        }

        // 3. Alimentar papel y cortar (5 nuevas líneas al final)
        commands.push(0x0A, 0x0A, 0x0A, 0x0A, 0x0A);
        // Comando de corte de papel si se solicita
        if (options.cut) {
            commands.push(0x1D, 0x56, 0x42, 0x00); // GS V 66 0
        }

        const dataBuffer = new Uint8Array(commands);
        
        // Escribir los datos en chunks de 100 bytes (para evitar desbordar el búfer BLE)
        const chunkSize = 100;
        for (let i = 0; i < dataBuffer.length; i += chunkSize) {
            const chunk = dataBuffer.slice(i, i + chunkSize);
            if (writeChar.properties.writeWithoutResponse) {
                await writeChar.writeValueWithoutResponse(chunk);
            } else {
                await writeChar.writeValue(chunk);
            }
            // Pequeña pausa para asegurar la recepción fluida
            await new Promise(r => setTimeout(r, 50));
        }

        console.log("[Bluetooth] Impresión completada exitosamente.");
        
        // Desconectar para no drenar la batería de la impresora portátil
        try {
            device.gatt.disconnect();
        } catch(e) {}
        
        return true;
    }
};

window.BluetoothPrinter = BluetoothPrinter;
