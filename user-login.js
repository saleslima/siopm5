import { authenticateUser } from './auth.js';
import { showUserDashboard } from './ui-screens.js';

export function setupUserLoginHandlers(userLoginForm, allScreens) {
    userLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cpfRe = document.getElementById('loginCpfRe').value.toUpperCase();
        const servico = document.getElementById('loginServico').value;
        const perfil = document.getElementById('loginPerfil').value;
        const paValue = document.getElementById('loginPA').value;
        const userLoginMessage = document.getElementById('userLoginMessage');

        const userData = await authenticateUser(cpfRe, servico, perfil, paValue, userLoginMessage);

        if (userData) {
            localStorage.setItem('copomUserSession', JSON.stringify(userData));
            showUserDashboard(userData, allScreens);
        }
    });
}

