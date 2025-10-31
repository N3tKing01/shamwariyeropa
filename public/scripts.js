document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // Elements
  const phoneInput = document.getElementById("phone");
  const requestPairingBtn = document.getElementById("requestPairing");
  const statusEl = document.getElementById("status");
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');

  // Initialize everything
  initBinaryBackground();
  initAnimations();
  createParticles();
  setupEventListeners();

  // Set current year in footer
  document.getElementById('year').textContent = new Date().getFullYear();

  function setupEventListeners() {
    // Pairing functionality
    requestPairingBtn.addEventListener("click", handlePairingRequest);

    // Mobile menu toggle
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Close sidebar when clicking on links (mobile)
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          closeMobileMenu();
        }
      });
    });

    // Close sidebar when clicking outside (mobile)
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
          closeMobileMenu();
        }
      }
    });

    // Handle Enter key in phone input
    phoneInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        requestPairingBtn.click();
      }
    });

    // Input validation for phone number
    phoneInput.addEventListener("input", function(e) {
      this.value = this.value.replace(/\D/g, '');
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Add hover effect to buttons
    document.querySelectorAll('.btn').forEach(button => {
      button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px) scale(1.02)';
      });
      
      button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
      });
    });
  }

  async function handlePairingRequest() {
    const number = phoneInput.value.trim();
    if (!number) {
      showStatus("❌ Please enter your phone number (with country code).", "error");
      return;
    }

    // Validate phone number format
    if (!/^[0-9]{8,15}$/.test(number.replace(/\D/g, ''))) {
      showStatus("❌ Please enter a valid phone number (digits only, 8-15 characters).", "error");
      return;
    }

    showStatus("<span class='spinner'></span> Requesting pairing code...", "loading");
    requestPairingBtn.disabled = true;
    requestPairingBtn.classList.add("loading");

    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        showStatus("❌ Error: " + (data.error || "Failed to request pairing"), "error");
        return;
      }

      const code = (data.pairingCode || "").toString().trim();
      const spacedCode = code.split("").join(" ");
      
      showStatus(`
        <div style="text-align: center;">
          <p style="margin-bottom: 20px; font-size: 1.1rem;">✅ Pairing code for <strong>${number}</strong>:</p>
          <div class="pairing-code" id="pairingCode">${spacedCode}</div>
          <p style="margin-top: 16px; opacity: 0.8;"><small>Click the code to copy — then enter it in WhatsApp to complete pairing.</small></p>
        </div>
      `, "success");

      setupCopyFunctionality(code);
    } catch (err) {
      console.error("Pairing request failed", err);
      showStatus("❌ Failed to request pairing code (network or server error).", "error");
    } finally {
      requestPairingBtn.disabled = false;
      requestPairingBtn.classList.remove("loading");
    }
  }

  function setupCopyFunctionality(code) {
    const pairingEl = document.getElementById("pairingCode");
    if (pairingEl) {
      pairingEl.addEventListener("click", () => {
        navigator.clipboard.writeText(code)
          .then(() => {
            const originalText = pairingEl.textContent;
            pairingEl.textContent = "Copied!";
            pairingEl.style.letterSpacing = "2px";
            pairingEl.style.background = "rgba(65, 105, 225, 0.3)";
            pairingEl.style.boxShadow = "0 0 30px rgba(65, 105, 225, 0.5)";
            
            setTimeout(() => {
              pairingEl.textContent = originalText;
              pairingEl.style.letterSpacing = "8px";
              pairingEl.style.background = "rgba(0, 0, 0, 0.4)";
              pairingEl.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.2)";
            }, 2000);
          })
          .catch(() => {
            showStatus("❌ Failed to copy to clipboard. Please manually copy the code.", "error");
          });
      });
    }
  }

  function toggleMobileMenu() {
    sidebar.classList.toggle('active');
    mobileMenuToggle.innerHTML = sidebar.classList.contains('active') 
      ? '<i class="fas fa-times"></i>' 
      : '<i class="fas fa-bars"></i>';
  }

  function closeMobileMenu() {
    sidebar.classList.remove('active');
    mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
  }

  // Socket events
  socket.on("statsUpdate", ({ activeSockets, totalUsers }) => {
    animateCounter("activeSockets", activeSockets);
    animateCounter("totalUsers", totalUsers);
  });

  socket.on("linked", ({ sessionId }) => {
    showStatus(`
      <div style="text-align: center;">
        <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 20px; animation: bounce 2s infinite; color: var(--success);"></i>
        <h3 style="margin-bottom: 16px; color: var(--success);">✅ Successfully Linked!</h3>
        <p>Your device has been successfully connected. You can now use BLEADER-MD features.</p>
        <p style="margin-top: 12px; opacity: 0.8;"><small>Session ID: ${sessionId}</small></p>
      </div>
    `, "success");
    
    phoneInput.value = "";
    createConfetti();
  });

  socket.on("pairingTimeout", ({ number }) => {
    showStatus(`
      <div style="text-align: center;">
        <i class="fas fa-clock" style="font-size: 2.5rem; margin-bottom: 16px; color: var(--warning);"></i>
        <h3 style="margin-bottom: 12px; color: var(--warning);">⏰ Pairing Code Expired</h3>
        <p>Pairing code for ${number} has expired.</p>
        <p>Please request a new code if you still need to connect.</p>
      </div>
    `, "warning");
  });

  function showStatus(message, type = "") {
    statusEl.innerHTML = message;
    statusEl.className = "status-message";
    if (type) statusEl.classList.add(`status-${type}`);
    
    // Reset animation
    statusEl.style.animation = 'none';
    setTimeout(() => {
      statusEl.style.animation = 'fadeIn 0.5s ease forwards';
    }, 10);
  }

  function initBinaryBackground() {
    const binaryContainer = document.querySelector('.binary-background');
    const binaryChars = ['0', '1'];
    
    for (let i = 0; i < 50; i++) {
      const binary = document.createElement('div');
      binary.className = 'binary-code';
      
      let binaryString = '';
      for (let j = 0; j < 100; j++) {
        binaryString += binaryChars[Math.floor(Math.random() * binaryChars.length)];
      }
      
      binary.textContent = binaryString;
      binary.style.left = Math.random() * 100 + '%';
      binary.style.animationDelay = Math.random() * 20 + 's';
      
      binaryContainer.appendChild(binary);
    }
  }

  function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = window.innerWidth < 768 ? 25 : 50;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');
      
      const size = Math.random() * 4 + 1;
      const posX = Math.random() * 100;
      const delay = Math.random() * 20;
      const duration = Math.random() * 15 + 20;
      
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${posX}%`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;
      
      particlesContainer.appendChild(particle);
    }
  }

  function initAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.card, .feature-item, .stat-item').forEach(element => {
      observer.observe(element);
    });

    const header = document.querySelector('.hero-section');
    header.style.opacity = '0';
    header.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      header.style.transition = 'opacity 1s ease, transform 1s ease';
      header.style.opacity = '1';
      header.style.transform = 'translateY(0)';
    }, 300);
  }

  function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const step = (targetValue - currentValue) / (duration / 16);
    
    let current = currentValue;
    const timer = setInterval(() => {
      current += step;
      if ((step > 0 && current >= targetValue) || (step < 0 && current <= targetValue)) {
        current = targetValue;
        clearInterval(timer);
      }
      element.textContent = Math.round(current);
    }, 16);
  }

  function createConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      pointer-events: none; z-index: 9999;
    `;
    document.body.appendChild(confettiContainer);

    const colors = ['#4169e1', '#1e40af', '#3b82f6', '#2563eb', '#93c5fd'];

    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: absolute;
        width: ${Math.random() * 10 + 5}px;
        height: ${Math.random() * 10 + 5}px;
        background-color: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        left: ${Math.random() * 100}vw;
        top: -10px;
        opacity: ${Math.random() * 0.5 + 0.5};
      `;
      confettiContainer.appendChild(confetti);

      const animation = confetti.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(100vh) rotate(${Math.random() * 360}deg)`, opacity: 0 }
      ], {
        duration: Math.random() * 3000 + 2000,
        easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)'
      });

      animation.onfinish = () => {
        confetti.remove();
        if (confettiContainer.children.length === 0) {
          confettiContainer.remove();
        }
      };
    }
  }

  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    .btn { position: relative; overflow: hidden; transition: all 0.3s ease; }
    .loading { opacity: 0.7; pointer-events: none; }
  `;
  document.head.appendChild(style);
});