// =========================================
// APP LOGIC & WHITE LABEL INJECTION
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Fetch White Label Configuration
    // In a real SaaS app, this would be fetched from an API based on the domain/URL
    try {
        const response = await fetch('./config.json');
        const config = await response.json();
        
        // 2. Apply branding
        applyBranding(config);
        
        // 3. Render services
        renderServices(config.services);
        
    } catch (error) {
        console.error("Kunde inte ladda konfigurationen.", error);
        document.getElementById('salon-name').innerText = "Välkommen";
    }

    // 4. Setup Interactivity
    setupModal();
});

function applyBranding(config) {
    // Set Texts
    document.getElementById('salon-name').innerText = config.salonName;
    document.getElementById('salon-tagline').innerText = config.tagline;
    document.title = `Boka tid - ${config.salonName}`;

    // Inject CSS variables for absolute White-Label capability
    const root = document.documentElement;
    if (config.theme) {
        if (config.theme.backgroundColor) root.style.setProperty('--bg-color', config.theme.backgroundColor);
        if (config.theme.primaryAccent) {
            root.style.setProperty('--accent-color', config.theme.primaryAccent);
            // Optional: calculate a slightly lighter hover state using color manipulation
            // For now, let's keep it simple
        }
        if (config.theme.textColor) root.style.setProperty('--text-color', config.theme.textColor);
    }
}

function renderServices(services) {
    const listContainer = document.getElementById('services-list');
    listContainer.innerHTML = ''; // Clear empty state

    services.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
            <div>
                <div class="service-name">${service.name}</div>
                <div class="service-price" style="font-size:0.8rem; margin-top:2px;">${service.duration}</div>
            </div>
            <div class="service-price">${service.price}</div>
        `;
        
        // When clicking a service, go to next step
        card.addEventListener('click', () => {
            goToStep(2);
        });

        listContainer.appendChild(card);
    });
}

function setupModal() {
    const modal = document.getElementById('booking-modal');
    const bookBtn = document.getElementById('book-btn');
    const closeBtn = document.getElementById('close-modal');
    const backBtn = document.getElementById('back-to-step-1');

    // Open Modal
    bookBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        goToStep(1); // Reset to first step
    });

    // Close Modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Back button inside modal
    backBtn.addEventListener('click', () => {
        goToStep(1);
    });
}

function goToStep(stepNumber) {
    document.querySelectorAll('.booking-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`step-${stepNumber}`).classList.add('active');
}
