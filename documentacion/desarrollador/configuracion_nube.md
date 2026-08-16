# 🚀 Configuración para Sincronización Mundial (Railway.app)

He preparado el sistema para que pueda vivir en la nube. Esto permitirá que todos tus dispositivos estén sincronizados sin depender de una IP local.

## 📦 1. Preparación del Código
He modificado el archivo `backend/server.js` y `js/config.js` para que el sistema:
- Detecte automáticamente si está en un servidor web.
- Use los puertos dinámicos que asigna la nube (Railway/Render).
- Separe la **base de datos** de la carpeta del código (fundamental para no perder datos al actualizar).

## 🛠️ 2. Pasos para subir a Railway.app
Para que el sistema funcione 24/7 y se sincronice entre el PC y el celular:

1.  **Sube a GitHub:** Crea un repositorio privado en GitHub y sube este proyecto.
2.  **Crea un proyecto en Railway:**
    - Ve a [Railway.app](https://railway.app/) y crea un nuevo proyecto desde tu Repo de GitHub.
3.  **Configura el "Volume" (VITAL):**
    - En la configuración de tu servicio en Railway, ve a **Volumes**.
    - Crea un nuevo Volumen y ponle el nombre de montaje: `/app/data`.
4.  **Configura las Variables de Entorno (Variables):**
    - Agrega una nueva variable llamada `DATA_DIR` con el valor `/app/data`.
    - Railway asignará automáticamente la variable `PORT`, así que no necesitas tocarla.

## 📱 3. Acceso desde Celular
Una vez termine el despliegue, Railway te dará una URL (ej: `https://lakurva.up.railway.app`):
- Abre ese link en tu celular.
- Dale a los **tres puntos (⋮)** > **Instalar Aplicación**.
- El icono que generamos aparecerá en tu menú de apps.

## 🔄 4. Cómo trabajar con cambios nuevos
De ahora en adelante, cada vez que hagamos un cambio aquí:
1. Yo programo la mejora.
2. Tú haces: `git push origin main`.
3. **Automáticamente**, Railway actualizará el sistema en el PC del local y en tu celular al mismo tiempo. No necesitas enviar archivos por Drive ni recompilar el .exe.

---
*Hecho con 💙 para Minimarket La Kurva.*
