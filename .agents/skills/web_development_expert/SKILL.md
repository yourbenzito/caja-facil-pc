---
name: web_development_expert
description: Directrices y mejores prácticas para el diseño y desarrollo de interfaces web de alto impacto visual y rendimiento en HTML, CSS y JS.
---

# 🎨 Guía de Desarrollo Web y Diseño Premium

Esta habilidad proporciona directrices y estándares para crear interfaces de usuario hermosas, rápidas y accesibles, utilizando tecnologías nativas de la web (HTML, CSS vainilla y JavaScript).

---

## 🏛️ 1. Estructura y Semántica (HTML5)

Un buen frontend comienza con una estructura semántica clara. Esto mejora la accesibilidad, el SEO y la mantenibilidad del código.

- **Estructura jerárquica clara:** Usa etiquetas semánticas (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`) en lugar de `<div>` anidados sin sentido.
- **Encabezados:** Cada página debe tener exactamente un `<h1>` principal. La jerarquía de encabezados (`<h2>`, `<h3>`, etc.) debe ser lógica y descendente.
- **Formularios:** Asocia siempre los `<label>` con sus `<input>` correspondientes usando el atributo `for` e `id`.
- **Identificadores Únicos:** Asegúrate de que todos los elementos interactivos tengan un `id` único y descriptivo para facilitar pruebas automáticas y manipulación desde JavaScript.

---

## 💅 2. Diseño Visual Premium y Estética (CSS Vainilla)

Evita diseños planos y genéricos. Las interfaces deben sentirse premium, modernas y fluidas.

### Paleta de Colores y Tipografía
- **Colores Armoniosos:** Evita usar colores planos básicos (como rojo, verde o azul puros). Utiliza variables CSS (`--primary`, `--secondary`, etc.) con tonos HSL seleccionados para crear un tema cohesivo y armónico.
- **Modo Oscuro / Claro:** Diseña con soporte para temas de color. Usa variables CSS para facilitar el cambio dinámico de tema.
- **Tipografía:** Importa tipografías modernas (por ejemplo, desde Google Fonts como *Inter*, *Outfit*, o *Roboto*) en lugar de depender de las fuentes por defecto del sistema.

### Técnicas de Diseño Moderno
- **Glassmorphism:** Para paneles flotantes, modales o barras de navegación, utiliza un fondo semi-transparente con desenfoque de fondo:
  ```css
  .glass-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
  }
  ```
- **Gradientes Suaves:** Utiliza gradientes sutiles y modernos de 2 o 3 colores en fondos o botones de llamada a la acción.
- **Sombras con Profundidad:** Usa sombras suaves en capas para simular elevación (por ejemplo, `box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);`).

### Micro-animaciones e Interactividad
- **Transiciones Suaves:** Todos los elementos interactivos (botones, enlaces, tarjetas) deben tener transiciones suaves al cambiar de estado:
  ```css
  .button-primary {
    transition: background-color 0.3s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .button-primary:hover {
    transform: translateY(-2px);
  }
  .button-primary:active {
    transform: translateY(0);
  }
  ```
- **Micro-interacciones:** Agrega sutiles animaciones de carga, efectos al pasar el cursor (hover) y retroalimentación activa que hagan sentir la interfaz dinámica y viva.

---

## ⚡ 3. Lógica y Optimización (JavaScript)

- **Manipulación del DOM Eficiente:** Minimiza los accesos y escrituras en el DOM. Utiliza `DocumentFragment` cuando necesites insertar múltiples elementos a la vez.
- **Event Delegation:** En lugar de agregar escuchadores de eventos a múltiples elementos individuales, agrégalos a un contenedor común para mejorar el rendimiento.
- **Filosofía Ponytail (Código Simple):**
  - Utiliza APIs nativas del navegador siempre que sea posible.
  - No instales dependencias externas de JS si la biblioteca estándar o una funcionalidad nativa puede resolver el problema de forma sencilla.
- **Rendimiento:** Implementa técnicas de *lazy loading* para imágenes y recursos pesados. Evita procesos bloqueantes en el hilo principal para que la interfaz nunca se congele.

---

## 🔍 4. SEO y Accesibilidad (a11y)

- **Título y Metadatos:** Cada página debe tener una etiqueta `<title>` descriptiva y meta tags correspondientes para SEO (descripción, keywords, etc.).
- **Navegación por Teclado:** Asegúrate de que todos los elementos interactivos sean accesibles mediante la tecla `Tab` y tengan un estado `:focus` claramente visible.
- **Atributos ARIA:** Utiliza atributos `aria-label`, `aria-expanded`, `aria-hidden` y roles semánticos para que los lectores de pantalla puedan interpretar la interfaz correctamente.
- **Contraste de Color:** Asegura una relación de contraste adecuada entre el texto y el fondo para garantizar la legibilidad.
