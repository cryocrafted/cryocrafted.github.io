class GameTracker {
    constructor() {
        this.games = {
            toPlay: [],
            completed: [],
            finished: [],
            waiting: []
        };
        this.currentGameImage = null;
        this.currentBannerData = null;

        this.init();
    }

    init() {
        console.log('GameTracker: Starting initialization...');
        this.loadData();
        console.log('GameTracker: Data loaded, games:', this.games);
        this.bindEvents();
        this.setupDropZones();
        this.setupModal();
        this.setupTitleEasterEgg();
        this.setupSidebar();
        console.log('GameTracker: About to render...');
        this.render();
        this.updateStorageTracker();
        console.log('GameTracker: Initialization complete');
    }

    bindEvents() {
        const gameInput = document.getElementById('gameInput');
        const addBtn = document.getElementById('addGameBtn');
        const tableSelect = document.getElementById('tableSelect');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');
        const imageBtn = document.getElementById('imageBtn');
        const imageInput = document.getElementById('imageInput');
        const helpBtn = document.getElementById('helpBtn');

        addBtn.addEventListener('click', () => this.addGame());
        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => importFile.click());
        imageBtn.addEventListener('click', () => imageInput.click());
        helpBtn.addEventListener('click', () => this.showHelp());
        
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const success = this.importData(event.target.result);
                    if (success) {
                        this.showAlert('Import Successful', 'Game data and reviews imported successfully!');
                    } else {
                        this.showAlert('Import Failed', 'Failed to import data. Please check the file format.');
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

        imageInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        const closePreview = document.getElementById('closePreview');
        const confirmBanner = document.getElementById('confirmBanner');
        const cancelBanner = document.getElementById('cancelBanner');
        const posX = document.getElementById('posX');
        const posY = document.getElementById('posY');

        if (closePreview) {
            closePreview.addEventListener('click', () => this.closeBannerPreview());
        }
        if (confirmBanner) {
            confirmBanner.addEventListener('click', () => this.confirmBannerImage());
        }
        if (cancelBanner) {
            cancelBanner.addEventListener('click', () => this.closeBannerPreview());
        }
        if (posX) {
            posX.addEventListener('input', (e) => this.updateBannerPreview(e.target.value, 'x'));
        }
        if (posY) {
            posY.addEventListener('input', (e) => this.updateBannerPreview(e.target.value, 'y'));
        }

        addBtn.disabled = !gameInput.value.trim();
    }

    setupSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mainContent = document.querySelector('.main-content');

        if (!sidebar || !sidebarToggle || !mainContent) return;

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarToggle.classList.toggle('active');
            mainContent.classList.toggle('shifted');
        });

        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
                    sidebar.classList.remove('open');
                    sidebarToggle.classList.remove('active');
                    mainContent.classList.remove('shifted');
                }
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('open');
                sidebarToggle.classList.remove('active');
                mainContent.classList.remove('shifted');
            }
        });
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        const imageStatus = document.getElementById('imageStatus');
        const imageBtn = document.getElementById('imageBtn');
        
        if (!file) {
            this.currentGameImage = null;
            imageStatus.textContent = '';
            imageBtn.classList.remove('has-image');
            return;
        }

        if (!file.type.startsWith('image/')) {
            imageStatus.textContent = 'Not an image';
            imageStatus.className = 'image-status error';
            this.currentGameImage = null;
            imageBtn.classList.remove('has-image');
            return;
        }

        imageStatus.textContent = 'Compressing...';
        imageStatus.className = 'image-status processing';
        
        this.compressImage(file)
            .then(compressionResult => {
                const estimatedSize = (compressionResult.dataUrl.length * 0.75);
                
                if (estimatedSize > 2 * 1024 * 1024) {
                    imageStatus.textContent = 'Still too large after compression';
                    imageStatus.className = 'image-status error';
                    this.currentGameImage = null;
                    imageBtn.classList.remove('has-image');
                    return;
                }
                
                this.currentBannerData = {
                    imageUrl: compressionResult.dataUrl,
                    positionX: 50,
                    positionY: 50,
                    originalSizeKB: compressionResult.originalSizeKB,
                    compressedSizeKB: compressionResult.compressedSizeKB,
                    savings: compressionResult.savings
                };
                
                this.showBannerPreview(compressionResult.dataUrl);
            })
            .catch(error => {
                console.error('Image compression failed:', error);
                imageStatus.textContent = 'Compression failed';
                imageStatus.className = 'image-status error';
                this.currentGameImage = null;
                imageBtn.classList.remove('has-image');
            });
    }

    async compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            const originalSizeKB = file.size / 1024;
            
            img.onload = () => {
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                const tryWebP = () => {
                    const webpDataUrl = canvas.toDataURL('image/webp', quality);
                    if (webpDataUrl.startsWith('data:image/webp')) {
                        const compressedSizeKB = (webpDataUrl.length * 0.75) / 1024;
                        const savings = ((originalSizeKB - compressedSizeKB) / originalSizeKB * 100).toFixed(1);
                        resolve({
                            dataUrl: webpDataUrl,
                            originalSizeKB: originalSizeKB.toFixed(1),
                            compressedSizeKB: compressedSizeKB.toFixed(1),
                            savings: savings
                        });
                    } else {
                        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                        const compressedSizeKB = (jpegDataUrl.length * 0.75) / 1024;
                        const savings = ((originalSizeKB - compressedSizeKB) / originalSizeKB * 100).toFixed(1);
                        resolve({
                            dataUrl: jpegDataUrl,
                            originalSizeKB: originalSizeKB.toFixed(1),
                            compressedSizeKB: compressedSizeKB.toFixed(1),
                            savings: savings
                        });
                    }
                };
                
                try {
                    tryWebP();
                } catch (error) {
                    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                    const compressedSizeKB = (jpegDataUrl.length * 0.75) / 1024;
                    const savings = ((originalSizeKB - compressedSizeKB) / originalSizeKB * 100).toFixed(1);
                    resolve({
                        dataUrl: jpegDataUrl,
                        originalSizeKB: originalSizeKB.toFixed(1),
                        compressedSizeKB: compressedSizeKB.toFixed(1),
                        savings: savings
                    });
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    showHelp() {
        const helpModal = document.getElementById('helpModal');
        const helpClose = document.getElementById('helpClose');
        
        helpModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        const closeHelp = () => {
            helpModal.classList.remove('show');
            document.body.style.overflow = '';
        };
        
        helpClose.addEventListener('click', closeHelp);
        
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                closeHelp();
            }
        });
        
        const handleEscape = (e) => {
            if (e.key === 'Escape' && helpModal.classList.contains('show')) {
                closeHelp();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    setupTitleEasterEgg() {
        const titleElement = document.querySelector('header h1');
        const titleTextElement = document.getElementById('titleText');
        const originalTitleText = titleTextElement.textContent;
        let hoverTimer = null;
        let isEasterEggActive = false;

        titleElement.addEventListener('mouseenter', () => {
            if (isEasterEggActive) return;
            
            hoverTimer = setTimeout(() => {
                isEasterEggActive = true;
                titleTextElement.textContent = 'BOYA DEMANDS YOU MOVE THE MOUSE';
            }, 5000);
        });

        titleElement.addEventListener('mouseleave', () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
            
            if (isEasterEggActive) {
                titleTextElement.textContent = originalTitleText;
                isEasterEggActive = false;
            }
        });
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

    showConfirm(title, message, onConfirm, onCancel = null, confirmText = 'OK', cancelText = 'Cancel') {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalCancel.style.display = 'inline-block';
        
        modalConfirm.textContent = confirmText;
        modalCancel.textContent = cancelText;

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
            completion: 0,
            bannerImage: this.currentGameImage
        };

        if (targetTable === 'waiting') {
            newGame.releaseDate = '';
        }

        this.games[targetTable].push(newGame);
        
        gameInput.value = '';
        this.clearImageUpload();
        document.getElementById('addGameBtn').disabled = true;
        
        this.saveData();
        this.render();
    }

    clearImageUpload() {
        this.currentGameImage = null;
        const imageStatus = document.getElementById('imageStatus');
        const imageBtn = document.getElementById('imageBtn');
        const imageInput = document.getElementById('imageInput');
        
        if (imageStatus) {
            imageStatus.textContent = '';
            imageStatus.className = 'image-status';
        }
        if (imageBtn) {
            imageBtn.classList.remove('has-image');
        }
        if (imageInput) {
            imageInput.value = '';
        }
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

    changeBanner(gameId, fromTable) {
        const game = this.games[fromTable].find(g => g.id === gameId);
        if (!game) return;

        if (game.bannerImage) {
            this.showConfirm(
                'Banner Options',
                'Would you like to change the current banner or remove it entirely?',
                () => {
                    this.selectNewBanner(game, fromTable);
                },
                () => {
                    game.bannerImage = null;
                    this.saveData();
                    this.render();
                    this.showAlert('Banner Removed', 'Banner has been removed from this game.');
                },
                'Change Banner',
                'Remove Banner'
            );
        } else {
            this.selectNewBanner(game, fromTable);
        }
    }

    selectNewBanner(game, fromTable) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                this.showAlert('Invalid File', 'Please select an image file.');
                return;
            }

            this.showAlert('Processing', 'Compressing image, please wait...');
            
            this.compressImage(file)
                .then(compressionResult => {
                    const estimatedSize = (compressionResult.dataUrl.length * 0.75);
                    
                    if (estimatedSize > 2 * 1024 * 1024) {
                        this.closeModal(false);
                        this.showAlert('Image Too Large', 'Image is still too large after compression. Please try a smaller image.');
                        return;
                    }

                    const existingBanner = game.bannerImage;
                    this.currentBannerData = {
                        imageUrl: compressionResult.dataUrl,
                        positionX: existingBanner && typeof existingBanner === 'object' ? existingBanner.positionX : 50,
                        positionY: existingBanner && typeof existingBanner === 'object' ? existingBanner.positionY : 50,
                        game: game,
                        fromTable: fromTable,
                        originalSizeKB: compressionResult.originalSizeKB,
                        compressedSizeKB: compressionResult.compressedSizeKB,
                        savings: compressionResult.savings
                    };

                    this.closeModal(false);
                    this.showBannerPreview(compressionResult.dataUrl);
                })
                .catch(error => {
                    console.error('Image compression failed:', error);
                    this.showAlert('Compression Failed', 'Failed to compress the image. Please try a different image.');
                });
            
            document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
    }

    showBannerPreview(imageUrl) {
        const preview = document.getElementById('bannerPreview');
        const previewBanner = document.getElementById('previewBanner');
        const placeholder = document.querySelector('.preview-placeholder');
        const gameContent = document.querySelector('.preview-game-content');
        
        if (preview && previewBanner && this.currentBannerData) {
            if (placeholder) placeholder.style.display = 'none';
            if (gameContent) gameContent.style.display = 'block';
            
            this.populatePreviewWithGameData();
            
            const { positionX, positionY } = this.currentBannerData;
            previewBanner.style.backgroundImage = `url(${imageUrl})`;
            previewBanner.style.backgroundPosition = `${positionX}% ${positionY}%`;
            previewBanner.style.backgroundSize = 'cover';
            
            const posXSlider = document.getElementById('posX');
            const posYSlider = document.getElementById('posY');
            const posXValue = document.getElementById('posXValue');
            const posYValue = document.getElementById('posYValue');
            
            if (posXSlider) posXSlider.value = positionX;
            if (posYSlider) posYSlider.value = positionY;
            if (posXValue) posXValue.textContent = positionX + '%';
            if (posYValue) posYValue.textContent = positionY + '%';
            
            preview.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    updateBannerPreview(value, type) {
        const previewBanner = document.getElementById('previewBanner');
        const posXValue = document.getElementById('posXValue');
        const posYValue = document.getElementById('posYValue');
        
        if (!previewBanner || !this.currentBannerData) return;
        
        switch (type) {
            case 'x':
                this.currentBannerData.positionX = parseInt(value);
                if (posXValue) posXValue.textContent = value + '%';
                break;
            case 'y':
                this.currentBannerData.positionY = parseInt(value);
                if (posYValue) posYValue.textContent = value + '%';
                break;
        }
        
        const { positionX, positionY } = this.currentBannerData;
        previewBanner.style.backgroundPosition = `${positionX}% ${positionY}%`;
        previewBanner.style.backgroundSize = 'cover';
    }

    populatePreviewWithGameData() {
        if (!this.currentBannerData || !this.currentBannerData.game) return;
        
        const game = this.currentBannerData.game;
        const tableKey = this.currentBannerData.fromTable;
        
        const gameIndex = this.games[tableKey].findIndex(g => g.id === game.id);
        const position = gameIndex + 1;
        
        const orderCol = document.querySelector('.preview-order-col');
        if (orderCol) {
            orderCol.textContent = this.currentBannerData.fromTable === 'toPlay' ? position : '';
        }
        
        const gameName = document.querySelector('.preview-game-name');
        if (gameName) {
            gameName.textContent = game.name;
        }
        
        const completionContent = document.querySelector('.preview-completion-content');
        if (completionContent) {
            completionContent.innerHTML = '';
            
            if (tableKey === 'waiting') {
                if (game.releaseDate) {
                    const countdown = document.createElement('div');
                    countdown.className = 'release-countdown';
                    
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
                    
                    completionContent.appendChild(countdown);
                } else {
                    const addDateSpan = document.createElement('span');
                    addDateSpan.textContent = 'Add date';
                    addDateSpan.style.fontSize = '10px';
                    addDateSpan.style.opacity = '0.7';
                    completionContent.appendChild(addDateSpan);
                }
            } else {
                const completionInput = document.createElement('input');
                completionInput.type = 'number';
                completionInput.className = 'completion-input';
                completionInput.value = game.completion || 0;
                completionInput.readOnly = true;
                completionInput.style.width = '30px';
                completionInput.style.height = '16px';
                completionInput.style.fontSize = '10px';
                completionInput.style.textAlign = 'center';
                completionInput.style.border = 'none';
                completionInput.style.background = 'rgba(255, 255, 255, 0.1)';
                completionInput.style.color = '#ffffff';
                completionInput.style.borderRadius = '2px';
                
                const percentLabel = document.createElement('span');
                percentLabel.textContent = '%';
                percentLabel.className = 'completion-display';
                percentLabel.style.marginLeft = '2px';
                
                completionContent.appendChild(completionInput);
                completionContent.appendChild(percentLabel);
            }
        }
        
        const actionButtons = document.querySelector('.preview-action-buttons');
        if (actionButtons) {
            actionButtons.innerHTML = '';
            
            const bannerBtn = document.createElement('button');
            bannerBtn.innerHTML = game.bannerImage ? '🖼️' : '📷';
            bannerBtn.title = game.bannerImage ? 'Change banner' : 'Add banner';
            actionButtons.appendChild(bannerBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete game';
            actionButtons.appendChild(deleteBtn);
        }
    }



    confirmBannerImage() {
        if (!this.currentBannerData) return;
        
        const { imageUrl, positionX, positionY, game, fromTable } = this.currentBannerData;
        
        const bannerData = {
            imageUrl: imageUrl,
            positionX: positionX,
            positionY: positionY
        };
        
        if (game && fromTable) {
            game.bannerImage = bannerData;
            this.saveData();
            this.render();
            
            const compressionMessage = this.currentBannerData.originalSizeKB && this.currentBannerData.compressedSizeKB && this.currentBannerData.savings
                ? `Banner has been updated with your positioning preferences!\n\nCompression: ${this.currentBannerData.originalSizeKB}KB → ${this.currentBannerData.compressedSizeKB}KB (${this.currentBannerData.savings}% smaller)`
                : 'Banner has been updated with your positioning preferences!';
            
            this.showAlert('Banner Updated', compressionMessage);
        } else {
            this.currentGameImage = bannerData;
            const imageStatus = document.getElementById('imageStatus');
            const imageBtn = document.getElementById('imageBtn');
            
            if (imageStatus) {
                const statusText = this.currentBannerData.originalSizeKB && this.currentBannerData.compressedSizeKB && this.currentBannerData.savings
                    ? `Banner ready (${this.currentBannerData.originalSizeKB}KB → ${this.currentBannerData.compressedSizeKB}KB, ${this.currentBannerData.savings}% smaller)`
                    : 'Banner ready';
                imageStatus.textContent = statusText;
                imageStatus.className = 'image-status success';
            }
            if (imageBtn) {
                imageBtn.classList.add('has-image');
            }
        }
        
        this.closeBannerPreview();
    }

    closeBannerPreview() {
        const preview = document.getElementById('bannerPreview');
        const previewBanner = document.getElementById('previewBanner');
        const placeholder = document.querySelector('.preview-placeholder');
        const gameContent = document.querySelector('.preview-game-content');
        
        if (preview) {
            preview.style.display = 'none';
        }
        if (placeholder) {
            placeholder.style.display = 'block';
        }
        if (gameContent) {
            gameContent.style.display = 'none';
        }
        if (previewBanner) {
            previewBanner.style.backgroundImage = 'none';
        }
        
        document.body.style.overflow = '';
        this.currentBannerData = null;
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

        const bannerBtn = document.createElement('button');
        bannerBtn.className = 'btn btn-banner';
        bannerBtn.innerHTML = game.bannerImage ? '🖼️' : '📷';
        bannerBtn.title = game.bannerImage ? 'Change banner' : 'Add banner';
        bannerBtn.onclick = () => this.changeBanner(game.id, table);
        buttonsDiv.appendChild(bannerBtn);

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
        console.log('GameTracker: Starting render...');
        this.renderTable('toPlay', 'toPlayBody', 'toPlayEmpty', true);
        this.renderTable('completed', 'completedBody', 'completedEmpty', false);
        this.renderTable('finished', 'finishedBody', 'finishedEmpty', false);
        this.renderTable('waiting', 'waitingBody', 'waitingEmpty', false);
        console.log('GameTracker: Render complete');
    }

    renderTable(tableKey, bodyId, emptyId, showOrder) {
        console.log(`GameTracker: Rendering table ${tableKey}, games:`, this.games[tableKey]);
        const tbody = document.getElementById(bodyId);
        const emptyDiv = document.getElementById(emptyId);
        let games = this.games[tableKey];
        
        if (!tbody) {
            console.error(`GameTracker: Could not find tbody element with id ${bodyId}`);
            return;
        }
        if (!emptyDiv) {
            console.error(`GameTracker: Could not find empty div element with id ${emptyId}`);
            return;
        }

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
                
                if (game.bannerImage) {
                    if (typeof game.bannerImage === 'string') {
                        row.style.backgroundImage = `url(${game.bannerImage})`;
                        row.style.backgroundSize = 'cover';
                        row.style.backgroundPosition = 'center';
                    } else {
                        row.style.backgroundImage = `url(${game.bannerImage.imageUrl})`;
                        row.style.backgroundSize = 'cover';
                        row.style.backgroundPosition = `${game.bannerImage.positionX || 50}% ${game.bannerImage.positionY || 50}%`;
                    }
                    row.style.backgroundRepeat = 'no-repeat';
                    row.classList.add('has-banner');
                }
                
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
            this.updateStorageTracker();
        } catch (error) {
            console.error('Failed to save data:', error);
            this.updateStorageTracker();
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
        const reviewsData = localStorage.getItem('gameReviews');
        const reviews = reviewsData ? JSON.parse(reviewsData) : [];
        
        const fullData = {
            games: this.games,
            reviews: reviews,
            exportDate: new Date().toISOString(),
            version: '1.1'
        };
        
        const dataStr = JSON.stringify(fullData, null, 2);
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
            
            if (data.games && data.version) {
                if (data.games.toPlay && data.games.completed && data.games.finished) {
                    this.games = data.games;
                    this.saveData();
                    
                    if (data.reviews && Array.isArray(data.reviews)) {
                        localStorage.setItem('gameReviews', JSON.stringify(data.reviews));
                    }
                    
                    this.render();
                    this.updateStorageTracker();
                    return true;
                }
            } 
            else if (data.toPlay && data.completed && data.finished) {
                this.games = data;
                this.saveData();
                this.render();
                this.updateStorageTracker();
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

    calculateLocalStorageSize() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                if (value) {
                    totalSize += key.length * 2 + value.length * 2;
                }
            }
        }
        return totalSize;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0.0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    updateStorageTracker() {
        const storageUsedElement = document.getElementById('storageUsed');
        const storageProgressElement = document.getElementById('storageProgress');
        
        if (!storageUsedElement || !storageProgressElement) {
            return;
        }

        const usedBytes = this.calculateLocalStorageSize();
        const maxBytes = 10 * 1024 * 1024;
        const percentUsed = (usedBytes / maxBytes) * 100;

        storageUsedElement.textContent = this.formatBytes(usedBytes);
        storageProgressElement.style.width = `${Math.min(percentUsed, 100)}%`;

        storageProgressElement.classList.remove('warning', 'critical');
        if (percentUsed >= 90) {
            storageProgressElement.classList.add('critical');
        } else if (percentUsed >= 75) {
            storageProgressElement.classList.add('warning');
        }

        if (percentUsed >= 95) {
            console.warn(`localStorage usage is at ${Math.round(percentUsed)}% (${this.formatBytes(usedBytes)} / 10MB). Consider exporting your data.`);
        }
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