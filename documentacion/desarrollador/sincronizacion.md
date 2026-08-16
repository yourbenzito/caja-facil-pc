# 🌐 Guía de Sincronización y Acceso Móvil (Sin IP)

Esta guía te explica cómo hacer que tu sistema de ventas funcione en tu celular y otros computadores de forma simultánea, sin tener que escribir direcciones IP cada vez.

## 1. El concepto: La Nube (Cloud)
Para no depender de tu red local o de una IP, el sistema debe vivir en un servidor en internet. Esto permite que:
- Tu celular entre con un nombre (ej: `https://lakurva.up.railway.app`).
- El PC de ventas use la misma dirección.
- Todo lo que hagas en uno se vea en el otro al instante.

## 2. Pasos para subirlo a la Nube (Railway / Render)

### Paso A: Preparar el código
Ya hemos preparado el sistema con un **Manifest** y un **Service Worker** para que se comporte como una App real en el celular.

### Paso B: Subir a un Hosting
Te recomiendo usar **Railway.app** (es muy estable y fácil):
1. Crea una cuenta en [Railway.app](https://railway.app/).
2. Sube esta carpeta a un repositorio de GitHub (o súbelo directo si usas su CLI).
3. Railway detectará el `package.json` y levantará el servidor automáticamente.
4. **IMPORTANTE:** En Railway, debes configurar un "Volume" (Volumen) para la base de datos `database.sqlite`, así tus datos no se borran al reiniciar el servidor.

## 3. Instalar la App en tu Celular (PWA)
Una vez que tengas tu URL (ej: `https://mi-tienda.railway.app`):
1. Abre **Google Chrome** en tu celular.
2. Ingresa a la URL de tu sistema.
3. Toca los **tres puntos (⋮)** arriba a la derecha.
4. Selecciona **"Instalar aplicación"** o **"Agregar a la pantalla de inicio"**.
5. ¡Listo! Ahora aparecerá el icono de "La Kurva" en tu menú de aplicaciones y funcionará en pantalla completa.

## 4. Beneficios de esta configuración
- ✅ **Sincronización Total:** Si vendes algo en el celular, el stock se descuenta en el PC al segundo.
- ✅ **Sin IP:** Entras con un nombre fácil de recordar.
- ✅ **Seguridad:** El servidor usa HTTPS, lo que activa todas las funciones de seguridad y escaneo de códigos de barra en el celular.
- ✅ **Multidispositivo:** Puedes tener 5 celulares y 2 PC funcionando al mismo tiempo.

---
> **Nota:** Si prefieres no usar la nube y seguir en local pero sin escribir la IP, recuerda que puedes usar herramientas como **Ngrok** para crear un túnel temporal.
