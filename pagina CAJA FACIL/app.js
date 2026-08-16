/* 
  Lógica interactiva, animaciones y carrusel para CajaFácil
  Estilo Google Antigravity e Ingepav Soluciones - 2026
*/

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. BARRA DE PROGRESO DE LECTURA ---
  const progressBar = document.getElementById('scroll-progress-bar');
  
  window.addEventListener('scroll', () => {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    const scrollPercentage = (scrollTop / (documentHeight - windowHeight)) * 100;
    progressBar.style.width = `${scrollPercentage}%`;
  });


  // --- 2. INTERSECTION OBSERVER (SCROLL REVEAL) ---
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));


  // --- 3. EFECTO 3D TILT (MOUSE TRACKING) ---
  const cards3d = document.querySelectorAll('.card-3d');
  cards3d.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      
      const rotateX = ((height / 2 - y) / (height / 2)) * 10;
      const rotateY = (((x - width / 2) / (width / 2)) * 10);
      
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      card.style.boxShadow = `
        ${-rotateY * 1.2}px ${rotateX * 1.2}px 25px rgba(163, 177, 198, 0.7),
        ${rotateY * 1.2}px ${-rotateX * 1.2}px 25px rgba(255, 255, 255, 0.8)
      `;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
      card.style.boxShadow = 'var(--shadow-out)';
    });
  });


  // --- 4. LEVITACIÓN EN SCROLL (ANTIGRAVITY PARALLAX) ---
  const levitateSlow = document.querySelectorAll('.levitate-slow');
  const levitateMid = document.querySelectorAll('.levitate-mid');
  const heroDashboard = document.getElementById('hero-dashboard');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Parallax vertical de levitación
    levitateSlow.forEach(el => {
      el.style.transform = `translateY(${scrollY * -0.04}px)`;
    });

    levitateMid.forEach(el => {
      el.style.transform = `translateY(${scrollY * -0.09}px)`;
    });

    // Inclinación del dashboard en Hero vinculada al scroll (cuando no hay mouse hover)
    if (heroDashboard && !heroDashboard.matches(':hover')) {
      const maxScrollTilt = 15;
      const tiltAngle = Math.min(scrollY / 35, maxScrollTilt);
      heroDashboard.style.transform = `rotateX(${tiltAngle}deg) rotateY(${-tiltAngle / 2}deg)`;
    }
  });


  // --- 5. CARRUSEL DINÁMICO EN HERO ---
  const carouselTrack = document.getElementById('hero-carousel-track');
  const dots = document.querySelectorAll('.carousel-dot');
  let currentSlide = 0;
  const totalSlides = 3;
  let slideInterval;

  function goToSlide(index) {
    currentSlide = index;
    // Traduce el track horizontalmente (cada slide ocupa 33.333% del track de 300%)
    carouselTrack.style.transform = `translateX(-${currentSlide * 33.333}%)`;
    
    // Actualizar dots
    dots.forEach((dot, idx) => {
      if (idx === currentSlide) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    goToSlide(currentSlide);
  }

  function startCarousel() {
    slideInterval = setInterval(nextSlide, 5500); // Rota cada 5.5 segundos
  }

  function stopCarousel() {
    clearInterval(slideInterval);
  }

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const slideIndex = parseInt(e.target.getAttribute('data-slide'));
      stopCarousel();
      goToSlide(slideIndex);
      startCarousel(); // Reinicia el timer
    });
  });

  if (carouselTrack && dots.length > 0) {
    startCarousel();
  }


  // --- 6. CANVAS: GRILLA MAGNÉTICA INTERACTIVA ---
  const canvas = document.getElementById('magnetic-grid-canvas');
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  
  const mouse = { x: null, y: null };
  const gridSpacing = 40;
  let points = [];

  function initPoints() {
    points = [];
    for (let x = 0; x < width; x += gridSpacing) {
      for (let y = 0; y < height; y += gridSpacing) {
        points.push({ x, y, origX: x, origY: y });
      }
    }
  }

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initPoints();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  function drawGrid() {
    ctx.clearRect(0, 0, width, height);
    
    points.forEach(pt => {
      let targetX = pt.origX;
      let targetY = pt.origY;
      
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - pt.origX;
        const dy = mouse.y - pt.origY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 180) {
          const force = (180 - dist) / 180;
          const angle = Math.atan2(dy, dx);
          targetX = pt.origX - Math.cos(angle) * force * 18;
          targetY = pt.origY - Math.sin(angle) * force * 18;
        }
      }
      
      pt.x += (targetX - pt.x) * 0.1;
      pt.y += (targetY - pt.y) * 0.1;
      
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(163, 177, 198, 0.4)';
      ctx.fill();
    });
    
    requestAnimationFrame(drawGrid);
  }

  if (canvas) {
    initPoints();
    drawGrid();
  }


  // --- 7. SIMULADOR DE CONSOLA CORE (ENGINE LOGS) ---
  const terminalLogs = document.getElementById('terminal-logs');
  const engineSteps = [
    { text: "[SISTEMA] Iniciando CajaFácil POS Engine...", type: "sys" },
    { text: "[DATABASE] Conectado a SQLite local en modo WAL.", type: "sys" },
    { text: "[SISTEMA] Listo para vender. Dispositivo de impresión OK.", type: "sys" },
    { text: "[ESCANER] Código detectado: 780123456789 (Leche Entera 1L)", type: "normal" },
    { text: "[DATABASE] Buscando SKU en SQLite...", type: "sys" },
    { text: "[STOCK] Producto encontrado. Existencias actuales: 32", type: "sys" },
    { text: "[STOCK] Restando 1 unidad... Nuevo Stock: 31", type: "warn" },
    { text: "[VENTA] Item añadido: Leche Entera 1L - Subtotal: $1.200", type: "normal" },
    { text: "[ESCANER] Código detectado: 780987654321 (Pan de Molde)", type: "normal" },
    { text: "[STOCK] Restando 1 unidad... Nuevo Stock: 15", type: "warn" },
    { text: "[VENTA] Item añadido: Pan de Molde - Subtotal: $2.400", type: "normal" },
    { text: "[LÓGICA] Aplicando IVA (19%): $456", type: "sys" },
    { text: "[CAJA] Total venta: $2.400. Pago del cliente: $3.000", type: "normal" },
    { text: "[LÓGICA] Ley de Redondeo 20.956: Vuelto exacto de $600", type: "sys" },
    { text: "[IMPRESORA] Imprimiendo boleta fiscal... OK", type: "sys" },
    { text: "[CAJA] Cajón de dinero abierto automáticamente.", type: "sys" },
    { text: "[DATABASE] Guardando venta localmente... OK", type: "sys" },
    { text: "[AUDITORÍA] Movimiento inmutable de caja registrado.", type: "warn" },
    { text: "[SINCRONIZACIÓN] Sin conexión de red. Datos en cola local segura.", type: "warn" }
  ];

  let logIndex = 0;
  function printNextLog() {
    if (logIndex < engineSteps.length) {
      const step = engineSteps[logIndex];
      const logLine = document.createElement('div');
      logLine.className = `terminal-line ${step.type}`;
      logLine.textContent = `> ${step.text}`;
      terminalLogs.appendChild(logLine);
      
      terminalLogs.scrollTop = terminalLogs.scrollHeight;
      logIndex++;
      setTimeout(printNextLog, 1300);
    } else {
      setTimeout(() => {
        terminalLogs.innerHTML = '';
        logIndex = 0;
        printNextLog();
      }, 3000);
    }
  }
  
  if (terminalLogs) {
    printNextLog();
  }


  // --- 8. CALCULADORA DE RETORNO DE INVERSIÓN (ROI) ---
  const sliderVentas = document.getElementById('slider-ventas');
  const sliderMermas = document.getElementById('slider-mermas');
  const valVentas = document.getElementById('val-ventas');
  const valMermas = document.getElementById('val-mermas');
  const lossMonthly = document.getElementById('loss-monthly');
  const saveYearly = document.getElementById('save-yearly');

  function formatCLP(value) {
    return '$' + Math.round(value).toLocaleString('es-CL');
  }

  function calculateROI() {
    const ventas = parseInt(sliderVentas.value);
    const mermasPercent = parseFloat(sliderMermas.value);
    
    valVentas.textContent = formatCLP(ventas);
    valMermas.textContent = `${mermasPercent.toFixed(1)}%`;
    
    const loss = ventas * (mermasPercent / 100);
    lossMonthly.textContent = formatCLP(loss);
    
    const save = loss * 12 * 0.85;
    saveYearly.textContent = formatCLP(save);
  }

  if (sliderVentas && sliderMermas) {
    sliderVentas.addEventListener('input', calculateROI);
    sliderMermas.addEventListener('input', calculateROI);
    calculateROI();
  }


  // --- 9. CONTROL DEL SIMULADOR DE SUSCRIPCIÓN OFFLINE ---
  const btnToggleConnection = document.getElementById('btn-toggle-connection');
  const widgetStatus = document.getElementById('widget-status');
  const daysCount = document.getElementById('days-count');
  const widgetMsg = document.getElementById('widget-msg');
  
  let isOnline = true;
  let simulatedDays = 30;
  let countdownInterval = null;

  function updateWidgetUI() {
    if (isOnline) {
      widgetStatus.textContent = 'Estado: Online';
      widgetStatus.className = 'status-badge status-online';
      widgetMsg.textContent = 'Días de respaldo local garantizado. Base de datos al día.';
      btnToggleConnection.textContent = 'Simular Corte de Red';
      
      clearInterval(countdownInterval);
      simulatedDays = 30;
      daysCount.textContent = simulatedDays;
    } else {
      widgetStatus.textContent = 'Estado: Offline (Sin red)';
      widgetStatus.className = 'status-badge status-offline';
      widgetMsg.textContent = 'Licencia validada localmente. Registrando ventas offline.';
      btnToggleConnection.textContent = 'Reconectar Internet';
      
      countdownInterval = setInterval(() => {
        if (simulatedDays > 1) {
          simulatedDays--;
          daysCount.textContent = simulatedDays;
        } else {
          clearInterval(countdownInterval);
          widgetMsg.textContent = 'Licencia local expirada. Por favor, conéctese para renovar.';
        }
      }, 2000);
    }
  }

  if (btnToggleConnection) {
    btnToggleConnection.addEventListener('click', () => {
      isOnline = !isOnline;
      updateWidgetUI();
    });
  }


  // --- 10. INTERRUPTOR DE PRECIOS HÍBRIDOS (UF) ---
  const priceSwitch = document.getElementById('price-switch');
  const subPrice = document.getElementById('sub-price');

  if (priceSwitch) {
    priceSwitch.addEventListener('click', () => {
      priceSwitch.classList.toggle('active');
      if (priceSwitch.classList.contains('active')) {
        subPrice.innerHTML = '<sup>UF</sup>0,4<span>/ mes (facturado anual)</span>';
      } else {
        subPrice.innerHTML = '<sup>UF</sup>0,5<span>/ mes</span>';
      }
    });
  }


  // --- 11. SIMULADOR DE DESCARGAS Y ALERTA DE WHATSAPP ---
  const downloadBtns = document.querySelectorAll('.download-btn-trigger, #download-btn-nav, #download-btn-hero, #buy-local-btn, #buy-hybrid-btn');

  downloadBtns.forEach(btn => {
    if (btn && btn.id !== 'support-whatsapp-btn') {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        btn.style.boxShadow = 'var(--shadow-in)';
        setTimeout(() => {
          btn.style.boxShadow = btn.classList.contains('btn-primary') 
            ? '6px 6px 12px rgba(79, 70, 229, 0.3), -6px -6px 12px rgba(255, 255, 255, 0.8)' 
            : 'var(--shadow-out)';
        }, 150);

        alert('🎉 ¡Iniciando descarga del instalador CajaFácil POS (.exe)!\n\nUna vez descargado, ejecútalo para instalar la base de datos local e iniciar el punto de venta de forma 100% offline.');
      });
    }
  });

});
