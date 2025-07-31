class GameTracker {
    constructor() {
        this.games = {
            toPlay: [],
            completed: [],
            finished: [],
            waiting: []
        };

        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
        this.setupDropZones();
        this.setupModal();
        this.render();
    }

    bindEvents() {
        const gameInput = document.getElementById('gameInput');
        const addBtn = document.getElementById('addGameBtn');
        const tableSelect = document.getElementById('tableSelect');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');

        addBtn.addEventListener('click', () => this.addGame());
        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => importFile.click());
        
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const success = this.importData(event.target.result);
                    if (success) {
                        this.showAlert('Import Successful', 'Game data imported successfully!');
                    } else {
                        this.showAlert('Import Failed', 'Failed to import game data. Please check the file format.');
                    }
                };
                reader.readAsText(file);
            }
            e.target.value = '';
        });
        
        gameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addGame();
            }
        });

        gameInput.addEventListener('input', () => {
            addBtn.disabled = !gameInput.value.trim();
        });

        addBtn.disabled = !gameInput.value.trim();
    }

    setupModal() {
        const modal = document.getElementById('customModal');
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');

        modalCancel.addEventListener('click', () => {
            this.closeModal(false);
        });

        modalConfirm.addEventListener('click', () => {
            this.closeModal(true);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                this.closeModal(false);
            }
        });
    }

    showConfirm(title, message, onConfirm, onCancel = null) {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalCancel = document.getElementById('modalCancel');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalCancel.style.display = 'inline-block';

        this.modalCallback = { onConfirm, onCancel };
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    showAlert(title, message, onOk = null) {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalCancel = document.getElementById('modalCancel');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalCancel.style.display = 'none';

        this.modalCallback = { onConfirm: onOk, onCancel: null };
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal(confirmed) {
        const modal = document.getElementById('customModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';

        if (this.modalCallback) {
            if (confirmed && this.modalCallback.onConfirm) {
                this.modalCallback.onConfirm();
            } else if (!confirmed && this.modalCallback.onCancel) {
                this.modalCallback.onCancel();
            }
            this.modalCallback = null;
        }
    }

    addGame() {
        const gameInput = document.getElementById('gameInput');
        const tableSelect = document.getElementById('tableSelect');
        
        const gameName = gameInput.value.trim();
        const targetTable = tableSelect.value;

        if (!gameName) return;

        const allGames = [...this.games.toPlay, ...this.games.completed, ...this.games.finished, ...this.games.waiting];
        if (allGames.some(game => game.name.toLowerCase() === gameName.toLowerCase())) {
            this.showAlert('Duplicate Game', 'This game is already in your tracker!');
            return;
        }

        const newGame = {
            id: Date.now() + Math.random(),
            name: gameName,
            dateAdded: new Date().toISOString(),
            completion: 0
        };

        if (targetTable === 'waiting') {
            newGame.releaseDate = '';
        }

        this.games[targetTable].push(newGame);
        
        gameInput.value = '';
        document.getElementById('addGameBtn').disabled = true;
        
        this.saveData();
        this.render();
    }

    deleteGame(gameId, fromTable) {
        this.showConfirm(
            'Delete Game',
            'Are you sure you want to do this? It can\'t be undone but you can just add it again if you want, I\'m not the boss of you.',
            () => {
                this.games[fromTable] = this.games[fromTable].filter(game => game.id !== gameId);
                this.saveData();
                this.render();
            }
        );
    }

    updateGameCompletion(gameId, table, completion) {
        const game = this.games[table].find(game => game.id == gameId);
        if (game) {
            game.completion = completion;
            this.saveData();
        }
    }

    createCompletionInput(game, table) {
        const inputContainer = document.createElement('div');
        inputContainer.style.textAlign = 'center';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'completion-input';
        input.min = '0';
        input.max = '100';
        input.value = game.completion || 0;
        input.placeholder = '0';
        input.title = 'Enter completion percentage (0-100)';

        input.addEventListener('input', (e) => {
            let value = parseInt(e.target.value) || 0;
            value = Math.max(0, Math.min(100, value));
            e.target.value = value;
            this.updateGameCompletion(game.id, table, value);
        });

        input.addEventListener('blur', (e) => {
            if (e.target.value === '') {
                e.target.value = 0;
                this.updateGameCompletion(game.id, table, 0);
            }
        });

        const percentLabel = document.createElement('span');
        percentLabel.textContent = '%';
        percentLabel.className = 'completion-display';
        percentLabel.style.marginLeft = '2px';

        inputContainer.appendChild(input);
        inputContainer.appendChild(percentLabel);

        return inputContainer;
    }

    createReleaseDateInput(game, table) {
        const inputContainer = document.createElement('div');
        inputContainer.style.textAlign = 'center';

        if (game.releaseDate) {
            const countdown = document.createElement('div');
            countdown.className = 'release-countdown';
            countdown.title = 'Click to edit release date';
            
            const releaseInfo = this.calculateDaysUntilRelease(game.releaseDate);
            
            if (releaseInfo.isUnknown) {
                countdown.textContent = 'Unknown';
                countdown.classList.add('unknown');
            } else if (releaseInfo.isYearOnly) {
                if (releaseInfo.yearsUntil === 0) {
                    countdown.textContent = 'Soon™';
                    countdown.classList.add('soon', 'soon-tm');
                } else if (releaseInfo.yearsUntil < 0) {
                    const yearsPast = Math.abs(releaseInfo.yearsUntil);
                    countdown.textContent = yearsPast === 1 ? 'Released last year' : `Released ${yearsPast} years ago`;
                    countdown.classList.add('overdue');
                } else {
                    const yearsAway = releaseInfo.yearsUntil;
                    countdown.textContent = yearsAway === 1 ? 'a year, or less?' : `in ${yearsAway} years`;
                    countdown.classList.add('future-year');
                }
            } else {
                const daysUntil = releaseInfo.days;
                if (daysUntil < 0) {
                    countdown.textContent = `Released ${Math.abs(daysUntil)} days ago`;
                    countdown.classList.add('overdue');
                } else if (daysUntil === 0) {
                    countdown.textContent = 'Releases today!';
                    countdown.classList.add('soon');
                } else if (daysUntil <= 7) {
                    countdown.textContent = `${daysUntil} days left`;
                    countdown.classList.add('soon');
                } else {
                    countdown.textContent = `${daysUntil} days left`;
                }
            }
            
            countdown.addEventListener('click', () => {
                this.showDateInput(inputContainer, game, table);
            });
            
            inputContainer.appendChild(countdown);
        } else {
            this.showDateInput(inputContainer, game, table);
        }

        return inputContainer;
    }

    showDateInput(container, game, table) {
        container.innerHTML = '';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'release-date-input';
        input.value = game.releaseDate || '';
        input.placeholder = 'YYYY-MM-DD, YYYY, or Unknown';
        input.title = 'Enter release date (YYYY-MM-DD), just year (YYYY), or "Unknown"';

        const submitDate = () => {
            const value = input.value.trim();
            
            if (value && this.isValidDateInput(value) && value !== game.releaseDate) {
                const normalizedValue = value.toLowerCase() === 'unknown' ? 'Unknown' : value;
                this.updateGameReleaseDate(game.id, table, normalizedValue);
                this.render();
            } else if (!value && game.releaseDate) {
                this.updateGameReleaseDate(game.id, table, '');
                this.render();
            } else if (value && !this.isValidDateInput(value)) {
                this.showAlert('Invalid Date Format', 'Please enter a valid date format: YYYY-MM-DD, YYYY, or "Unknown"');
                input.value = game.releaseDate || '';
            }
        };

        input.addEventListener('blur', submitDate);

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });

        container.appendChild(input);
        input.focus();
    }

    isValidDateInput(value) {
        if (value && value.toLowerCase() === 'unknown') {
            return true;
        }
        
        if (/^\d{4}$/.test(value)) {
            const year = parseInt(value);
            return year >= 1900 && year <= 2100;
        }
        
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const date = new Date(value);
            return date instanceof Date && !isNaN(date) && value === date.toISOString().split('T')[0];
        }
        
        return false;
    }

    isYearOnly(releaseDate) {
        return /^\d{4}$/.test(releaseDate);
    }

    calculateDaysUntilRelease(releaseDate) {
        if (releaseDate && releaseDate.toLowerCase() === 'unknown') {
            return { isUnknown: true };
        }
        
        if (this.isYearOnly(releaseDate)) {
            const currentYear = new Date().getFullYear();
            const releaseYear = parseInt(releaseDate);
            return { isYearOnly: true, yearsUntil: releaseYear - currentYear };
        }
        
        const today = new Date();
        const release = new Date(releaseDate);
        
        today.setHours(0, 0, 0, 0);
        release.setHours(0, 0, 0, 0);
        
        const diffTime = release - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return { isYearOnly: false, days: diffDays };
    }

    updateGameReleaseDate(gameId, table, releaseDate) {
        const game = this.games[table].find(game => game.id == gameId);
        if (game) {
            game.releaseDate = releaseDate;
            this.saveData();
        }
    }

    createActionButtons(game, table) {
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'action-buttons';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete game';
        deleteBtn.onclick = () => this.deleteGame(game.id, table);
        buttonsDiv.appendChild(deleteBtn);

        return buttonsDiv;
    }

    setupDropZones() {
        const tableBodyIds = ['toPlayBody', 'completedBody', 'finishedBody', 'waitingBody'];
        
        tableBodyIds.forEach(bodyId => {
            const tbody = document.getElementById(bodyId);
            const section = tbody.closest('.table-section');
            
            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.handleDragOverFeedback(e, bodyId);
            });
            
            section.addEventListener('drop', (e) => {
                this.clearDropIndicators();
                this.handleDrop(e, bodyId);
            });
            
            section.addEventListener('dragenter', (e) => {
                e.preventDefault();
                section.classList.add('drag-over');
            });
            
            section.addEventListener('dragleave', (e) => {
                if (!section.contains(e.relatedTarget)) {
                    section.classList.remove('drag-over');
                    this.clearDropIndicators();
                }
            });
            
            tbody.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.handleDragOverFeedback(e, bodyId);
            });
            
            tbody.addEventListener('drop', (e) => {
                this.clearDropIndicators();
                this.handleDrop(e, bodyId);
            });
        });
    }

    handleDragStart(e) {
        this.draggedElement = e.target;
        this.draggedGameId = e.target.dataset.gameId;
        this.draggedSourceTable = e.target.dataset.sourceTable;
        
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        
        e.dataTransfer.setData('application/json', JSON.stringify({
            gameId: this.draggedGameId,
            sourceTable: this.draggedSourceTable
        }));
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        
        document.querySelectorAll('.table-section').forEach(section => {
            section.classList.remove('drag-over');
        });
        
        this.clearDropIndicators();
        
        this.draggedElement = null;
        this.draggedGameId = null;
        this.draggedSourceTable = null;
    }

    handleDragOverFeedback(e, bodyId) {
        if (!this.draggedGameId || !this.draggedSourceTable) return;
        
        const targetTable = this.getTableKeyFromBodyId(bodyId);
        const targetRow = e.target.closest('tr[data-game-id]');
        
        this.clearDropIndicators();
        
        if (targetTable === this.draggedSourceTable && targetRow && targetRow.dataset.gameId !== this.draggedGameId) {
            const rect = targetRow.getBoundingClientRect();
            const mouseY = e.clientY;
            const rowMiddle = rect.top + rect.height / 2;
            
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.innerHTML = '↓ Drop here to reorder';
            
            if (mouseY > rowMiddle) {
                targetRow.classList.add('drop-target-after');
                const targetGameId = targetRow.dataset.gameId;
                const currentIndex = this.games[targetTable].findIndex(game => game.id == targetGameId);
                const draggedIndex = this.games[targetTable].findIndex(game => game.id == this.draggedGameId);
                let newPosition = currentIndex + 1;
                
                if (draggedIndex < currentIndex) {
                    newPosition = currentIndex;
                }
                
                if (targetTable === 'toPlay') {
                    indicator.innerHTML = `↓ Move to position ${newPosition + 1}`;
                } else {
                    indicator.innerHTML = '↓ Drop here to reorder';
                }
            } else {
                targetRow.classList.add('drop-target-before');
                const targetGameId = targetRow.dataset.gameId;
                const currentIndex = this.games[targetTable].findIndex(game => game.id == targetGameId);
                const draggedIndex = this.games[targetTable].findIndex(game => game.id == this.draggedGameId);
                let newPosition = currentIndex;
                
                if (draggedIndex < currentIndex) {
                    newPosition = currentIndex - 1;
                }
                
                if (targetTable === 'toPlay') {
                    indicator.innerHTML = `↑ Move to position ${newPosition + 1}`;
                } else {
                    indicator.innerHTML = '↑ Drop here to reorder';
                }
            }
            
            targetRow.appendChild(indicator);
        }
        
        else if (targetTable !== this.draggedSourceTable) {
            const section = document.getElementById(bodyId).closest('.table-section');
            section.classList.add('cross-table-target');
        }
    }

    clearDropIndicators() {
        document.querySelectorAll('.drop-indicator').forEach(indicator => {
            indicator.remove();
        });
        
        document.querySelectorAll('.drop-target-before, .drop-target-after').forEach(row => {
            row.classList.remove('drop-target-before', 'drop-target-after');
        });
        
        document.querySelectorAll('.cross-table-target').forEach(section => {
            section.classList.remove('cross-table-target');
        });
    }

    handleDrop(e, bodyId = null) {
        e.preventDefault();
        e.stopPropagation();
        
        document.querySelectorAll('.table-section').forEach(section => {
            section.classList.remove('drag-over');
        });
        
        let draggedGameId = this.draggedGameId;
        let draggedSourceTable = this.draggedSourceTable;
        
        if (!draggedGameId || !draggedSourceTable) {
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                draggedGameId = dragData.gameId;
                draggedSourceTable = dragData.sourceTable;
            } catch (err) {
                return;
            }
        }
        
        if (!draggedGameId || !draggedSourceTable) {
            return;
        }
        
        let targetTable;
        
        if (bodyId) {
            targetTable = this.getTableKeyFromBodyId(bodyId);
        } else {
            const tableSection = e.target.closest('.table-section');
            if (tableSection) {
                const targetTBody = tableSection.querySelector('tbody');
                targetTable = this.getTableKeyFromBodyId(targetTBody.id);
            } else {
                targetTable = draggedSourceTable;
            }
        }
        
        let targetIndex = this.games[targetTable].length;
        
        const targetRow = e.target.closest('tr[data-game-id]');
        if (targetRow && targetRow.dataset.gameId && targetRow.dataset.gameId != draggedGameId) {
            const targetGameId = targetRow.dataset.gameId;
            const foundIndex = this.games[targetTable].findIndex(game => game.id == targetGameId);
            
            if (foundIndex !== -1) {
                targetIndex = foundIndex;
                
                const rect = targetRow.getBoundingClientRect();
                const mouseY = e.clientY;
                const rowMiddle = rect.top + rect.height / 2;
                
                if (mouseY > rowMiddle) {
                    targetIndex++;
                }
            }
        }
        
        this.moveGameToPosition(draggedGameId, draggedSourceTable, targetTable, targetIndex);
    }

    getTableKeyFromBodyId(bodyId) {
        switch (bodyId) {
            case 'toPlayBody': return 'toPlay';
            case 'completedBody': return 'completed';
            case 'finishedBody': return 'finished';
            case 'waitingBody': return 'waiting';
            default: return 'toPlay';
        }
    }

    getBodyIdFromTableKey(tableKey) {
        switch (tableKey) {
            case 'toPlay': return 'toPlayBody';
            case 'completed': return 'completedBody';
            case 'finished': return 'finishedBody';
            case 'waiting': return 'waitingBody';
            default: return 'toPlayBody';
        }
    }

    moveGameToPosition(gameId, fromTable, toTable, targetIndex) {
        const fromGames = this.games[fromTable];
        
        const gameIndex = fromGames.findIndex(game => game.id == gameId);
        
        if (gameIndex === -1) {
            return;
        }
        
        const game = fromGames.splice(gameIndex, 1)[0];
        
        if (fromTable === toTable && gameIndex < targetIndex) {
            targetIndex--;
        }
        
        targetIndex = Math.max(0, Math.min(targetIndex, this.games[toTable].length));
        
        if (toTable === 'waiting' && game.releaseDate === undefined) {
            game.releaseDate = '';
        }
        
        this.games[toTable].splice(targetIndex, 0, game);
        
        this.saveData();
        this.render();
    }

    render() {
        this.renderTable('toPlay', 'toPlayBody', 'toPlayEmpty', true);
        this.renderTable('completed', 'completedBody', 'completedEmpty', false);
        this.renderTable('finished', 'finishedBody', 'finishedEmpty', false);
        this.renderTable('waiting', 'waitingBody', 'waitingEmpty', false);
    }

    renderTable(tableKey, bodyId, emptyId, showOrder) {
        const tbody = document.getElementById(bodyId);
        const emptyDiv = document.getElementById(emptyId);
        let games = this.games[tableKey];

        if (tableKey === 'waiting') {
            games = [...games].sort((a, b) => {
                if (!a.releaseDate && !b.releaseDate) return 0;
                if (!a.releaseDate) return 1;
                if (!b.releaseDate) return -1;
                
                const aTimeInfo = this.calculateDaysUntilRelease(a.releaseDate);
                const bTimeInfo = this.calculateDaysUntilRelease(b.releaseDate);
                
                if (aTimeInfo.isUnknown && bTimeInfo.isUnknown) return 0;
                if (aTimeInfo.isUnknown) return 1;
                if (bTimeInfo.isUnknown) return -1;
                
                if (!aTimeInfo.isYearOnly && !bTimeInfo.isYearOnly) {
                    return aTimeInfo.days - bTimeInfo.days;
                }
                
                if (!aTimeInfo.isYearOnly && bTimeInfo.isYearOnly) {
                    return -1;
                }
                
                if (aTimeInfo.isYearOnly && !bTimeInfo.isYearOnly) {
                    return 1;
                }
                
                if (aTimeInfo.isYearOnly && bTimeInfo.isYearOnly) {
                    return aTimeInfo.yearsUntil - bTimeInfo.yearsUntil;
                }
                
                return 0;
            });
        }

        tbody.innerHTML = '';

        if (games.length === 0) {
            emptyDiv.classList.add('show');
            document.getElementById(bodyId.replace('Body', 'Table')).style.display = 'none';
        } else {
            emptyDiv.classList.remove('show');
            document.getElementById(bodyId.replace('Body', 'Table')).style.display = 'table';

            games.forEach((game, index) => {
                const row = document.createElement('tr');
                row.draggable = true;
                row.dataset.gameId = game.id;
                row.dataset.sourceTable = tableKey;
                
                row.addEventListener('dragstart', (e) => this.handleDragStart(e));
                row.addEventListener('dragend', (e) => this.handleDragEnd(e));
                
                if (showOrder) {
                    const orderCell = document.createElement('td');
                    orderCell.className = 'order-number';
                    orderCell.textContent = index + 1;
                    row.appendChild(orderCell);
                }

                const nameCell = document.createElement('td');
                nameCell.className = 'game-name';
                nameCell.textContent = game.name;
                nameCell.title = `Added: ${new Date(game.dateAdded).toLocaleDateString()}`;
                row.appendChild(nameCell);

                const completionCell = document.createElement('td');
                if (tableKey === 'waiting') {
                    completionCell.appendChild(this.createReleaseDateInput(game, tableKey));
                } else {
                    completionCell.appendChild(this.createCompletionInput(game, tableKey));
                }
                row.appendChild(completionCell);

                const actionsCell = document.createElement('td');
                actionsCell.appendChild(this.createActionButtons(game, tableKey));
                row.appendChild(actionsCell);

                tbody.appendChild(row);
            });
        }
    }

    saveData() {
        try {
            localStorage.setItem('gameTracker', JSON.stringify(this.games));
        } catch (error) {
            console.error('Failed to save data:', error);
        }
    }

    loadData() {
        try {
            const saved = localStorage.getItem('gameTracker');
            if (saved) {
                const data = JSON.parse(saved);
                
                if (data.toPlay && data.completed && data.finished) {
                    this.games = data;
                    
                    if (!this.games.waiting) {
                        this.games.waiting = [];
                    }
                    
                    Object.keys(this.games).forEach(tableKey => {
                        this.games[tableKey].forEach(game => {
                            if (game.completion === undefined) {
                                game.completion = 0;
                            }
                            if (tableKey === 'waiting' && game.releaseDate === undefined) {
                                game.releaseDate = '';
                            }
                        });
                    });
                } else {
                    console.warn('Invalid data structure, using defaults');
                }
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }

    exportData() {
        const dataStr = JSON.stringify(this.games, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'game-tracker-backup.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.toPlay && data.completed && data.finished) {
                this.games = data;
                this.saveData();
                this.render();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }

    getStats() {
        return {
            toPlay: this.games.toPlay.length,
            completed: this.games.completed.length,
            finished: this.games.finished.length,
            waiting: this.games.waiting.length,
            total: this.games.toPlay.length + this.games.completed.length + this.games.finished.length + this.games.waiting.length
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gameTracker = new GameTracker();
    
    const stats = window.gameTracker.getStats();
    if (stats.total === 0) {
        console.log('First time setup - you can add some games to get started!');
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.gameTracker.exportData();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('gameInput').focus();
    }
});

window.exportGameData = () => window.gameTracker.exportData();
window.getGameStats = () => window.gameTracker.getStats();
window.clearAllGames = () => {
    window.gameTracker.showConfirm(
        'Clear All Games',
        'Are you sure you want to clear ALL games? This action cannot be undone!',
        () => {
            window.gameTracker.games = { toPlay: [], completed: [], finished: [], waiting: [] };
            window.gameTracker.saveData();
            window.gameTracker.render();
        }
    );
};