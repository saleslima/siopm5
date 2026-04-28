import { getData } from './database.js';
import { showMessage, showScreen } from './utils.js';
import { PASSWORDS } from './constants.js';

export function setupSupervCivilHandlers(allScreens) {
    const btnSupervCivil = document.getElementById('btnSupervCivil');
    const supervCivilPasswordScreen = document.getElementById('supervCivilPasswordScreen');
    const supervCivilScreen = document.getElementById('supervCivilScreen');
    const loginScreen = document.getElementById('loginScreen');
    const supervCivilPasswordForm = document.getElementById('supervCivilPasswordForm');
    const btnBackFromSupervCivilPassword = document.getElementById('btnBackFromSupervCivilPassword');
    const btnBackFromSupervCivil = document.getElementById('btnBackFromSupervCivil');
    const supervCivilPasswordMessage = document.getElementById('supervCivilPasswordMessage');

    btnSupervCivil.addEventListener('click', () => {
        showScreen(supervCivilPasswordScreen, allScreens);
        document.getElementById('supervCivilPassword').value = '';
    });

    btnBackFromSupervCivilPassword.addEventListener('click', () => {
        showScreen(loginScreen, allScreens);
        document.getElementById('supervCivilPassword').value = '';
    });

    btnBackFromSupervCivil.addEventListener('click', () => {
        showScreen(loginScreen, allScreens);
    });

    supervCivilPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('supervCivilPassword').value;

        if (password === PASSWORDS.CADASTRO) {
            showScreen(supervCivilScreen, allScreens);
            
            // Set default dates (today)
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
            document.getElementById('supervCivilDataInicio').value = formatDateTimeForInput(startOfDay);
            document.getElementById('supervCivilDataFim').value = formatDateTimeForInput(now);
            
            await loadSupervCivilData();
            startRealtimeMonitoring();
        } else {
            showMessage(supervCivilPasswordMessage, 'Senha incorreta!', 'error');
        }
    });

    const btnFiltrarRelatorio = document.getElementById('btnFiltrarRelatorio');
    if (btnFiltrarRelatorio) {
        btnFiltrarRelatorio.addEventListener('click', async () => {
            await loadSupervCivilData();
        });
    }
}

function formatDateTimeForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

let monitoringInterval = null;

let currentStatusFilter = 'TODOS';

function startRealtimeMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);
    
    // Setup filter buttons
    document.querySelectorAll('.btn-filter-status').forEach(btn => {
        btn.addEventListener('click', () => {
            currentStatusFilter = btn.getAttribute('data-filter');
            
            // Update button styles
            document.querySelectorAll('.btn-filter-status').forEach(b => {
                b.style.background = '#2c3e50';
            });
            btn.style.background = '#1976d2';
            
            loadRealtimeStatus();
        });
    });
    
    loadRealtimeStatus();
    monitoringInterval = setInterval(loadRealtimeStatus, 5000);
}

async function loadRealtimeStatus() {
    const realtimeContainer = document.getElementById('realtimeStatusContainer');
    if (!realtimeContainer) return;

    try {
        const pauseSessions = await getData('pauseSessions');
        const pauseLimits = await getData('pauseTimeLimits') || { banheiro: 10, alimentacao: 30, janta: 60 };
        const thresholds = await getData('pauseThresholds') || { yellowPercent: 20, redPercent: 50 };
        
        if (!pauseSessions) {
            realtimeContainer.innerHTML = '<p style="text-align: center; color: #999;">Nenhuma sessão ativa no momento.</p>';
            return;
        }

        let activeSessions = Object.values(pauseSessions).filter(s => !s.fim);
        
        // Apply filter
        if (currentStatusFilter !== 'TODOS') {
            activeSessions = activeSessions.filter(s => s.tipo === currentStatusFilter);
        }
        
        if (activeSessions.length === 0) {
            realtimeContainer.innerHTML = '<p style="text-align: center; color: #999;">Nenhuma sessão ativa com este filtro.</p>';
            return;
        }

        const now = Date.now();
        let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        
        activeSessions.forEach(session => {
            const elapsed = now - session.inicioTimestamp;
            const limit = session.tipo === 'BANHEIRO' ? pauseLimits.banheiro * 60 * 1000 : 
                         session.tipo === 'ALIMENTACAO' ? pauseLimits.alimentacao * 60 * 1000 :
                         session.tipo === 'JANTA/ALMOÇO' ? pauseLimits.janta * 60 * 1000 : 0;
            
            let statusColor = '#388e3c'; // Green for OPERANDO
            let statusClass = '';
            
            if (session.tipo === 'OPERANDO') {
                statusColor = '#388e3c'; // Green
            } else if (session.tipo === 'BANHEIRO' || session.tipo === 'ALIMENTACAO' || session.tipo === 'JANTA/ALMOÇO') {
                if (limit > 0 && elapsed > limit) {
                    statusColor = '#d32f2f'; // Red when exceeded
                    statusClass = 'blink-red';
                } else {
                    statusColor = '#ff9800'; // Orange
                }
            }
            
            const duration = formatDuration(elapsed);
            
            html += `
                <div style="background: white; padding: 12px; border-left: 4px solid ${statusColor}; border-radius: 4px; display: flex; align-items: center; gap: 15px; ${statusClass ? 'animation: blink 1s infinite;' : ''}">
                    <div style="min-width: 120px;">
                        <span style="font-weight: 700; font-size: 14px; color: ${statusColor};">${session.tipo}</span>
                    </div>
                    <div style="flex: 1;">
                        <span style="font-weight: 600; font-size: 14px;">${session.userName}</span>
                        <span style="margin-left: 10px; font-size: 13px; color: #666;">P.A: ${session.pa}</span>
                    </div>
                    <div style="min-width: 100px; text-align: center;">
                        <span style="font-size: 18px; font-weight: 700; color: ${statusColor};">${duration}</span>
                    </div>
                    <div style="min-width: 150px; text-align: right;">
                        <span style="font-size: 12px; color: #666;">${session.inicio}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        realtimeContainer.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading realtime status:', error);
    }
}

async function loadSupervCivilData() {
    const supervCivilContent = document.getElementById('supervCivilContent');
    
    try {
        const dataInicio = document.getElementById('supervCivilDataInicio').value;
        const dataFim = document.getElementById('supervCivilDataFim').value;
        
        const startTimestamp = dataInicio ? new Date(dataInicio).getTime() : 0;
        const endTimestamp = dataFim ? new Date(dataFim).getTime() : Date.now();

        const pauseSessions = await getData('pauseSessions');
        
        if (!pauseSessions) {
            supervCivilContent.innerHTML = '<p style="text-align: center; color: #999;">Nenhuma sessão de pausa encontrada.</p>';
            return;
        }

        const filteredSessions = Object.values(pauseSessions).filter(session => {
            return session.inicioTimestamp >= startTimestamp && session.inicioTimestamp <= endTimestamp;
        });

        if (filteredSessions.length === 0) {
            supervCivilContent.innerHTML = '<p style="text-align: center; color: #999;">Nenhuma sessão de pausa encontrada no período selecionado.</p>';
            return;
        }

        const userSessions = {};
        filteredSessions.forEach(session => {
            const userId = session.userId;
            if (!userSessions[userId]) {
                userSessions[userId] = {
                    userName: session.userName,
                    pa: session.pa,
                    sessions: []
                };
            }
            userSessions[userId].sessions.push(session);
        });

        let html = `
            <div style="margin-bottom: 15px;">
                <button id="btnGerarPDFPausas" class="btn-cadastro" style="padding: 10px 20px;">📄 Gerar PDF</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 20px;">
        `;
        
        Object.values(userSessions).forEach(user => {
            const totalByType = {
                BANHEIRO: 0,
                ALIMENTACAO: 0,
                'JANTA/ALMOÇO': 0,
                OPERANDO: 0
            };

            user.sessions.forEach(session => {
                if (session.duracao) {
                    totalByType[session.tipo] = (totalByType[session.tipo] || 0) + session.duracao;
                }
            });

            html += `
                <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h3 style="margin-top: 0;">${user.userName} - P.A: ${user.pa}</h3>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 15px;">
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🚻 Banheiro</h4>
                            <p style="margin: 0; font-size: 24px; font-weight: 700;">${formatDuration(totalByType.BANHEIRO)}</p>
                        </div>
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🍴 Alimentação</h4>
                            <p style="margin: 0; font-size: 24px; font-weight: 700;">${formatDuration(totalByType.ALIMENTACAO)}</p>
                        </div>
                        <div style="background: #f0f0f0; padding: 15px; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🍽️ Janta/Almoço</h4>
                            <p style="margin: 0; font-size: 24px; font-weight: 700;">${formatDuration(totalByType['JANTA/ALMOÇO'])}</p>
                        </div>
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #388e3c;">💼 Operando</h4>
                            <p style="margin: 0; font-size: 24px; font-weight: 700;">${formatDuration(totalByType.OPERANDO)}</p>
                        </div>
                    </div>
                    
                    <details>
                        <summary style="cursor: pointer; font-weight: 600; margin-bottom: 10px;">Ver Detalhes (${user.sessions.length} sessões)</summary>
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${user.sessions.sort((a, b) => b.inicioTimestamp - a.inicioTimestamp).map(session => `
                                <div style="padding: 10px; background: #f9f9f9; margin-bottom: 5px; border-radius: 4px;">
                                    <p style="margin: 3px 0; font-size: 13px;"><strong>Tipo:</strong> ${session.tipo}</p>
                                    <p style="margin: 3px 0; font-size: 13px;"><strong>Início:</strong> ${session.inicio}</p>
                                    ${session.fim ? `<p style="margin: 3px 0; font-size: 13px;"><strong>Fim:</strong> ${session.fim}</p>` : '<p style="margin: 3px 0; font-size: 13px; color: #1976d2;"><strong>Status:</strong> Em andamento</p>'}
                                    ${session.duracao ? `<p style="margin: 3px 0; font-size: 13px;"><strong>Duração:</strong> ${formatDuration(session.duracao)}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </details>
                </div>
            `;
        });
        
        html += '</div>';
        supervCivilContent.innerHTML = html;
        
        // Setup PDF generation button
        const btnGerarPDFPausas = document.getElementById('btnGerarPDFPausas');
        if (btnGerarPDFPausas) {
            btnGerarPDFPausas.addEventListener('click', () => {
                generatePausasPDF(userSessions, startTimestamp, endTimestamp);
            });
        }
        
    } catch (error) {
        supervCivilContent.innerHTML = `<p style="text-align: center; color: #d32f2f;">Erro ao carregar dados: ${error.message}</p>`;
    }
}

function formatDuration(ms) {
    if (!ms) return '0h 0min';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const displayMinutes = minutes % 60;
    
    return `${hours}h ${displayMinutes}min`;
}

async function generatePausasPDF(userSessions, startTimestamp, endTimestamp) {
    const { jsPDF } = await import("https://esm.sh/jspdf@2.5.1");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineHeight = 6;
    let yPosition = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Relatório de Pausas - Atendentes', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${new Date(startTimestamp).toLocaleString('pt-BR')} a ${new Date(endTimestamp).toLocaleString('pt-BR')}`, margin, yPosition);
    yPosition += 10;

    // Line separator
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Content
    Object.values(userSessions).forEach((user, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = margin;
        }

        const totalByType = {
            BANHEIRO: 0,
            ALIMENTACAO: 0,
            'JANTA/ALMOÇO': 0,
            OPERANDO: 0
        };

        user.sessions.forEach(session => {
            if (session.duracao) {
                totalByType[session.tipo] = (totalByType[session.tipo] || 0) + session.duracao;
            }
        });

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`${user.userName} - P.A: ${user.pa}`, margin, yPosition);
        yPosition += lineHeight + 2;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        const summaryLines = [
            `Banheiro: ${formatDuration(totalByType.BANHEIRO)}`,
            `Alimentação: ${formatDuration(totalByType.ALIMENTACAO)}`,
            `Janta/Almoço: ${formatDuration(totalByType['JANTA/ALMOÇO'])}`,
            `Operando: ${formatDuration(totalByType.OPERANDO)}`,
            `Total de Sessões: ${user.sessions.length}`
        ];

        summaryLines.forEach(line => {
            doc.text(line, margin + 5, yPosition);
            yPosition += lineHeight;
        });

        yPosition += 4;

        // Detailed sessions
        doc.setFontSize(9);
        doc.text('Detalhamento:', margin + 5, yPosition);
        yPosition += lineHeight;

        user.sessions.sort((a, b) => a.inicioTimestamp - b.inicioTimestamp).forEach((session, idx) => {
            if (yPosition > pageHeight - 30) {
                doc.addPage();
                yPosition = margin;
            }

            const sessionDetails = [
                `${idx + 1}. ${session.tipo}`,
                `   Início: ${session.inicio}`,
                session.fim ? `   Fim: ${session.fim}` : '   Status: Em andamento',
                session.duracao ? `   Duração: ${formatDuration(session.duracao)}` : ''
            ];

            sessionDetails.forEach(detail => {
                if (detail) {
                    doc.text(detail, margin + 10, yPosition);
                    yPosition += 4;
                }
            });
        });

        yPosition += 6;
        
        // Separator between users
        if (index < Object.values(userSessions).length - 1) {
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = margin;
            }
            doc.setDrawColor(200);
            doc.setLineWidth(0.1);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 8;
        }
    });

    const now = new Date();
    const fileName = `Relatorio_Pausas_${now.getTime()}.pdf`;
    doc.save(fileName);
}