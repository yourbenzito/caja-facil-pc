/**
 * Módulo de actualizaciones automáticas
 * Verifica si hay actualizaciones disponibles y permite descargar el nuevo instalador
 */

const { app, BrowserWindow, dialog } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class Updater {
    constructor() {
        this.updateUrl = process.env.UPDATE_URL || 'https://tudominio.com/updates';
        this.currentVersion = require('../version.json').version;
        this.updateInfo = null;
    }

    /**
     * Verifica si hay actualizaciones disponibles
     */
    async checkForUpdates() {
        try {
            const versionUrl = `${this.updateUrl}/version.json`;
            const versionInfo = await this.fetchJson(versionUrl);
            
            if (!versionInfo) {
                console.log('[Updater] No se pudo obtener información de versión');
                return null;
            }

            // Comparar versiones
            const remoteVersion = versionInfo.version;
            const isNewer = this.compareVersions(remoteVersion, this.currentVersion);

            if (isNewer) {
                this.updateInfo = versionInfo;
                console.log(`[Updater] Nueva versión disponible: ${remoteVersion} (actual: ${this.currentVersion})`);
                return versionInfo;
            } else {
                console.log('[Updater] No hay actualizaciones disponibles');
                return null;
            }
        } catch (error) {
            console.error('[Updater] Error verificando actualizaciones:', error.message);
            return null;
        }
    }

    /**
     * Compara dos versiones (formato semver)
     */
    compareVersions(remote, current) {
        const remoteParts = remote.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (remoteParts[i] > currentParts[i]) return true;
            if (remoteParts[i] < currentParts[i]) return false;
        }
        return false;
    }

    /**
     * Obtiene JSON desde una URL
     */
    fetchJson(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            protocol.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Descarga el instalador de actualización
     */
    async downloadUpdate(progressCallback) {
        if (!this.updateInfo || !this.updateInfo.downloadUrl) {
            throw new Error('No hay información de actualización disponible');
        }

        const downloadUrl = this.updateInfo.downloadUrl;
        const userDataPath = app.getPath('userData');
        const installerPath = path.join(userDataPath, `SistemaVentas-Setup-${this.updateInfo.version}.exe`);

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(installerPath);
            const protocol = downloadUrl.startsWith('https') ? https : http;

            protocol.get(downloadUrl, (res) => {
                const totalSize = parseInt(res.headers['content-length'], 10);
                let downloadedSize = 0;

                res.pipe(file);

                res.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (progressCallback) {
                        const progress = (downloadedSize / totalSize) * 100;
                        progressCallback(progress);
                    }
                });

                file.on('finish', () => {
                    file.close();
                    console.log('[Updater] Instalador descargado:', installerPath);
                    resolve(installerPath);
                });
            }).on('error', (err) => {
                fs.unlink(installerPath, () => {});
                reject(err);
            });
        });
    }

    /**
     * Muestra diálogo de actualización disponible
     */
    showUpdateAvailable(mainWindow) {
        if (!this.updateInfo) return;

        const options = {
            type: 'info',
            title: 'Actualización Disponible',
            message: `Nueva versión ${this.updateInfo.version} disponible`,
            detail: this.updateInfo.notes || 'Se recomienda actualizar para obtener las últimas mejoras y correcciones.',
            buttons: ['Descargar Actualización', 'Más Tarde'],
            defaultId: 0
        };

        dialog.showMessageBox(mainWindow, options).then(response => {
            if (response.response === 0) {
                this.downloadAndInstall(mainWindow);
            }
        });
    }

    /**
     * Descarga e instala la actualización
     */
    async downloadAndInstall(mainWindow) {
        try {
            // Mostrar progreso de descarga
            const progressWindow = new BrowserWindow({
                width: 400,
                height: 150,
                parent: mainWindow,
                modal: true,
                resizable: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });

            progressWindow.loadFile(path.join(__dirname, '../update-progress.html'));

            const installerPath = await this.downloadUpdate((progress) => {
                progressWindow.webContents.send('update-progress', progress);
            });

            progressWindow.webContents.send('update-complete');

            // Preguntar si quiere instalar ahora
            setTimeout(() => {
                const options = {
                    type: 'info',
                    title: 'Actualización Descargada',
                    message: 'La actualización ha sido descargada',
                    detail: '¿Deseas instalar la actualización ahora? La aplicación se cerrará durante la instalación.',
                    buttons: ['Instalar Ahora', 'Cancelar'],
                    defaultId: 0
                };

                dialog.showMessageBox(progressWindow, options).then(response => {
                    progressWindow.close();
                    
                    if (response.response === 0) {
                        this.installUpdate(installerPath);
                    }
                });
            }, 1000);

        } catch (error) {
            console.error('[Updater] Error descargando actualización:', error);
            dialog.showErrorBox('Error', 'No se pudo descargar la actualización: ' + error.message);
        }
    }

    /**
     * Ejecuta el instalador y cierra la aplicación
     */
    installUpdate(installerPath) {
        console.log('[Updater] Iniciando instalación:', installerPath);
        
        // Ejecutar el instalador
        exec(installerPath, (error) => {
            if (error) {
                console.error('[Updater] Error ejecutando instalador:', error);
            }
        });

        // Cerrar la aplicación
        app.quit();
    }
}

module.exports = new Updater();
