document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const API_URL = "https://api-emkc4yg6zq-uc.a.run.app";

    auth.onAuthStateChanged(user => {
        const currentPage = window.location.pathname.split('/').pop();

        if (user) { 
            if (currentPage === 'index.html' || currentPage === '') {
                window.location.href = 'app.html';
                return;
            }
            
            const userDisplayNameSpan = document.getElementById('user-display-name');
            const userGreetingH2 = document.getElementById('user-greeting');
            if (userDisplayNameSpan) userDisplayNameSpan.textContent = user.displayName;
            if (userGreetingH2) userGreetingH2.textContent = `¡Hola, ${user.displayName}!`;
        } else {
            if (currentPage === 'app.html') {
                window.location.href = 'index.html';
            }
        }
    });

    // --- FORMULARIO DE LOGIN/REGISTRO ---
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        const authTitle = document.getElementById('auth-title');
        const authEmailInput = document.getElementById('auth-email');
        const authUsernameInput = document.getElementById('auth-username');
        const authPasswordInput = document.getElementById('auth-password');
        const authActionButton = document.getElementById('auth-action-button');
        const authError = document.getElementById('auth-error');
        const toggleToRegister = document.getElementById('toggle-to-register');
        const toggleToLogin = document.getElementById('toggle-to-login');
        const toggleToRegisterContainer = document.getElementById('toggle-to-register-container');
        const toggleToLoginContainer = document.getElementById('toggle-to-login-container');

        toggleToRegister.addEventListener('click', () => {
            authForm.classList.add('register-mode');
            authTitle.textContent = 'Crear Cuenta';
            authUsernameInput.style.display = 'block';
            authUsernameInput.required = true;
            authActionButton.textContent = 'Crear Cuenta';
            toggleToRegisterContainer.classList.add('hidden');
            toggleToLoginContainer.classList.remove('hidden');
            authError.classList.add('hidden');
        });

        toggleToLogin.addEventListener('click', () => {
            authForm.classList.remove('register-mode');
            authTitle.textContent = 'Iniciar Sesión';
            authUsernameInput.style.display = 'none';
            authUsernameInput.required = false;
            authActionButton.textContent = 'Iniciar Sesión';
            toggleToRegisterContainer.classList.remove('hidden');
            toggleToLoginContainer.classList.add('hidden');
            authError.classList.add('hidden');
        });

        authForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = authEmailInput.value;
            const password = authPasswordInput.value;
            authError.classList.add('hidden');

            if (authForm.classList.contains('register-mode')) {
                const displayName = authUsernameInput.value;
                try {
                    const response = await fetch(`${API_URL}/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, displayName })
                    });
                    const data = await response.json();
                    if (!response.ok) { throw new Error(data.error || 'Error en el registro.'); }
                    await auth.signInWithEmailAndPassword(email, password);
                } catch (error) {
                    authError.textContent = error.message;
                    authError.classList.remove('hidden');
                }
            } else {
                try {
                    await auth.signInWithEmailAndPassword(email, password);
                } catch (error) {
                    authError.textContent = error.message;
                    authError.classList.remove('hidden');
                }
            }
        });
    }

    // --- LOGOUT ---
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut();
        });
    }
});