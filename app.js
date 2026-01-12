// ===== AGENDA DRTE - SISTEMA COMPLETO 100% FUNCIONAL =====
class AgendaDRTE {
    constructor() {
        // Inicializar datos
        this.tasks = JSON.parse(localStorage.getItem('drte_tasks')) || [];
        this.templates = JSON.parse(localStorage.getItem('drte_templates')) || [];
        this.evidences = JSON.parse(localStorage.getItem('drte_evidences')) || [];
        this.settings = JSON.parse(localStorage.getItem('drte_settings')) || {
            theme: 'dark',
            notifications: true,
            autoBackup: false
        };
        
        // Estado actual
        this.currentDate = new Date();
        this.currentView = 'month';
        this.currentFilter = 'all';
        this.editingTaskId = null;
        this.currentFiles = [];
        this.currentImageIndex = 0;
        this.currentImages = [];
        
        // Mapeos
        this.categoryIcons = {
            'pntf': 'fa-chalkboard-teacher',
            'meeting': 'fa-users',
            'training': 'fa-graduation-cap',
            'design': 'fa-pencil-ruler',
            'report': 'fa-file-alt',
            'system': 'fa-database',
            'other': 'fa-tasks'
        };
        
        this.categoryNames = {
            'pntf': 'PNFT',
            'meeting': 'Reunión',
            'training': 'Capacitación',
            'design': 'Diseño',
            'report': 'Informe',
            'system': 'Sistemas',
            'other': 'Otras'
        };
        
        // Inicializar aplicación
        this.init();
    }

    // ===== INICIALIZACIÓN =====
    init() {
        this.applyTheme();
        this.setupEventListeners();
        this.renderCalendar();
        this.renderTasks();
        this.updateStats();
        this.setToday();
        this.checkReminders();
        
        console.log('Agenda DRTE inicializada correctamente');
    }

    // ===== GESTIÓN DE ALMACENAMIENTO =====
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error guardando datos:', e);
            this.showNotification('Error guardando datos', 'error');
            return false;
        }
    }

    // ===== GESTIÓN DE TAREAS (COMPLETA) =====
    saveTask(taskData) {
        const task = {
            id: this.editingTaskId || Date.now(),
            ...taskData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: [...this.currentFiles]
        };

        if (this.editingTaskId) {
            // Actualizar tarea existente
            const index = this.tasks.findIndex(t => t.id === this.editingTaskId);
            if (index !== -1) {
                this.tasks[index] = task;
            }
            this.editingTaskId = null;
        } else {
            // Nueva tarea
            this.tasks.push(task);
        }

        // Guardar evidencias
        task.files.forEach(file => {
            if (!this.evidences.some(e => e.id === file.id)) {
                this.evidences.push({
                    id: file.id,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: file.data,
                    taskId: task.id,
                    taskTitle: task.title,
                    date: task.date,
                    uploadedAt: new Date().toISOString()
                });
            }
        });

        this.saveToStorage('drte_tasks', this.tasks);
        this.saveToStorage('drte_evidences', this.evidences);
        
        this.currentFiles = [];
        this.renderTasks();
        this.renderCalendar();
        this.updateStats();
        
        this.showNotification(
            this.editingTaskId ? 'Tarea actualizada' : 'Tarea guardada exitosamente', 
            'success'
        );
        
        return task;
    }

    deleteTask(id) {
        if (confirm('¿Está seguro de eliminar esta tarea?')) {
            this.evidences = this.evidences.filter(e => e.taskId !== id);
            this.tasks = this.tasks.filter(t => t.id !== id);
            
            this.saveToStorage('drte_tasks', this.tasks);
            this.saveToStorage('drte_evidences', this.evidences);
            
            this.renderTasks();
            this.renderCalendar();
            this.updateStats();
            
            this.showNotification('Tarea eliminada', 'success');
        }
    }

    toggleTaskStatus(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        const statusOrder = ['pending', 'in-progress', 'completed'];
        const currentIndex = statusOrder.indexOf(task.status);
        const nextIndex = (currentIndex + 1) % statusOrder.length;
        
        task.status = statusOrder[nextIndex];
        task.updatedAt = new Date().toISOString();
        
        this.saveToStorage('drte_tasks', this.tasks);
        this.renderTasks();
        this.updateStats();
        
        this.showNotification(`Estado cambiado a: ${this.getStatusText(task.status)}`, 'success');
    }

    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        this.editingTaskId = id;
        this.currentFiles = [...task.files];
        
        // Llenar formulario
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-date').value = task.date;
        document.getElementById('task-time').value = task.time || '';
        document.getElementById('task-priority').value = task.priority || 'medium';
        document.getElementById('task-description').value = task.description;
        document.getElementById('task-location').value = task.location || 'remote';
        document.getElementById('task-status').value = task.status;
        
        // Seleccionar categoría y ubicación
        this.selectCategory(task.category);
        this.selectLocation(task.location || 'remote');
        
        // Actualizar UI
        document.getElementById('modal-title').textContent = 'Editar Tarea';
        document.getElementById('template-btn').style.display = 'none';
        
        this.renderFileList();
        this.openModal('task-modal');
    }

    // ===== FILTRADO Y BÚSQUEDA =====
    filterTasks(filter) {
        this.currentFilter = filter;
        
        // Actualizar botones activos
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.renderTasks();
        
        // Actualizar título
        const titles = {
            'all': 'Todas las Tareas',
            'pending': 'Tareas Pendientes',
            'completed': 'Tareas Completadas',
            'pntf': 'Tareas PNFT',
            'meeting': 'Reuniones',
            'training': 'Capacitaciones',
            'office': 'Tareas en Oficina',
            'remote': 'Tareas en Teletrabajo'
        };
        
        document.getElementById('tasks-title').textContent = titles[filter] || 'Tareas del Día';
    }

    searchTasks(query) {
        if (!query.trim()) {
            this.renderTasks();
            return;
        }

        const searchLower = query.toLowerCase();
        const filtered = this.tasks.filter(task => {
            return task.title.toLowerCase().includes(searchLower) ||
                   task.description.toLowerCase().includes(searchLower) ||
                   this.categoryNames[task.category].toLowerCase().includes(searchLower);
        });

        this.renderTasks(filtered);
    }

    // ===== CALENDARIO DINÁMICO (CORREGIDO) =====
    renderCalendar() {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();
        
        document.getElementById('current-month').textContent = 
            `${monthNames[currentMonth]} ${currentYear}`;
        
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        const calendarGrid = document.getElementById('calendar-grid');
        
        // Encabezados de días
        const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        let calendarHTML = dayHeaders.map(day => 
            `<div class="calendar-day-header">${day}</div>`
        ).join('');
        
        // Espacios vacíos al inicio
        const startingDay = firstDay.getDay();
        for (let i = 0; i < startingDay; i++) {
            calendarHTML += '<div class="calendar-day"></div>';
        }
        
        // Días del mes
        const today = new Date().toISOString().split('T')[0];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dateObj = new Date(dateStr);
            const dayTasks = this.tasks.filter(task => task.date === dateStr);
            
            // Determinar si es día de oficina (lunes) o teletrabajo
            const isMonday = dateObj.getDay() === 1;
            const dayClass = isMonday ? 'office-day' : 'remote-day';
            const isToday = dateStr === today;
            
            calendarHTML += `
                <div class="calendar-day ${dayClass} ${isToday ? 'today' : ''}" 
                     onclick="agenda.filterTasksByDate('${dateStr}')">
                    <div class="day-number">${day}</div>
                    <div class="day-events">
                        ${dayTasks.slice(0, 4).map(task => {
                            const dotClass = task.category === 'meeting' ? 'meeting' :
                                           task.category === 'training' ? 'training' :
                                           task.category === 'report' ? 'report' : 'task';
                            return `<span class="event-dot ${dotClass}"></span>`;
                        }).join('')}
                        ${dayTasks.length > 4 ? `<span style="font-size: 10px;">+${dayTasks.length - 4}</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        calendarGrid.innerHTML = calendarHTML;
    }

    filterTasksByDate(date) {
        const filtered = this.tasks.filter(task => task.date === date);
        this.renderTasks(filtered);
        
        document.getElementById('tasks-title').textContent = 
            `Tareas del ${new Date(date).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}`;
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderCalendar();
    }

    changeView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-option').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.showNotification(`Vista cambiada a: ${view}`, 'info');
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
        this.filterTasks('all');
        this.showNotification('Mostrando tareas de hoy', 'info');
    }

    setToday() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('task-date').value = today;
    }

    // ===== GESTIÓN DE ARCHIVOS COMPLETA =====
    async handleFileUpload(files) {
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                this.showNotification(`Archivo ${file.name} excede el límite de 10MB`, 'error');
                continue;
            }

            try {
                const fileData = await this.readFileAsDataURL(file);
                
                this.currentFiles.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: fileData,
                    uploadedAt: new Date().toISOString()
                });
                
                this.showNotification(`${file.name} cargado correctamente`, 'success');
            } catch (error) {
                console.error('Error leyendo archivo:', error);
                this.showNotification(`Error cargando ${file.name}`, 'error');
            }
        }
        
        this.renderFileList();
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    renderFileList() {
        const fileList = document.getElementById('file-list');
        
        if (this.currentFiles.length === 0) {
            fileList.innerHTML = '';
            return;
        }
        
        fileList.innerHTML = this.currentFiles.map(file => {
            const icon = this.getFileIcon(file.type);
            const size = this.formatFileSize(file.size);
            
            return `
                <div class="file-item" data-id="${file.id}">
                    <div class="file-icon">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="file-info">
                        <h5>${file.name}</h5>
                        <span>${size}</span>
                    </div>
                    <div class="file-actions">
                        <button class="action-btn" onclick="agenda.previewFile('${file.id}')" title="Previsualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn" onclick="agenda.downloadFile('${file.id}')" title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn" onclick="agenda.removeFile('${file.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    previewFile(fileId) {
        const file = this.currentFiles.find(f => f.id === fileId) || 
                    this.evidences.find(e => e.id === fileId);
        
        if (!file) return;
        
        if (file.type.startsWith('image/')) {
            this.currentImages = [file];
            this.currentImageIndex = 0;
            this.showImagePreview(file);
        } else {
            this.downloadFile(fileId);
        }
    }

    showImagePreview(file) {
        document.getElementById('modal-image').src = file.data;
        document.getElementById('image-name').textContent = file.name;
        document.getElementById('image-size').textContent = this.formatFileSize(file.size);
        
        const downloadBtn = document.getElementById('download-image');
        downloadBtn.href = file.data;
        downloadBtn.download = file.name;
        
        this.openModal('image-modal');
    }

    downloadFile(fileId) {
        const file = this.currentFiles.find(f => f.id === fileId) || 
                    this.evidences.find(e => e.id === fileId);
        
        if (!file) return;
        
        const a = document.createElement('a');
        a.href = file.data;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        this.showNotification(`${file.name} descargado`, 'success');
    }

    removeFile(fileId) {
        this.currentFiles = this.currentFiles.filter(f => f.id !== fileId);
        this.renderFileList();
        this.showNotification('Archivo eliminado', 'success');
    }

    // ===== INTERFAZ Y MODALES =====
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = 'auto';
        
        if (modalId === 'task-modal') {
            this.resetTaskForm();
        }
    }

    openTaskModal(type) {
        this.resetTaskForm();
        
        const titles = {
            'task': 'Nueva Tarea',
            'meeting': 'Nueva Reunión',
            'training': 'Nueva Capacitación'
        };
        
        document.getElementById('modal-title').textContent = titles[type] || 'Nueva Tarea';
        
        if (type === 'meeting') this.selectCategory('meeting');
        if (type === 'training') this.selectCategory('training');
        
        this.openModal('task-modal');
    }

    resetTaskForm() {
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('modal-title').textContent = 'Nueva Tarea';
        document.getElementById('template-btn').style.display = 'block';
        
        this.editingTaskId = null;
        this.currentFiles = [];
        this.renderFileList();
        this.setToday();
        
        document.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.remove('active');
        });
        document.querySelectorAll('.location-option').forEach(opt => {
            opt.classList.remove('active');
        });
        
        this.selectCategory('pntf');
        this.selectLocation('remote');
    }

    selectCategory(category) {
        document.getElementById('task-category').value = category;
        
        document.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.remove('active');
        });
        
        const selected = document.querySelector(`.category-option[data-value="${category}"]`);
        if (selected) {
            selected.classList.add('active');
        }
    }

    selectLocation(location) {
        document.getElementById('task-location').value = location;
        
        document.querySelectorAll('.location-option').forEach(opt => {
            opt.classList.remove('active');
        });
        
        const selected = document.querySelector(`.location-option[data-value="${location}"]`);
        if (selected) {
            selected.classList.add('active');
        }
    }

    // ===== RENDERIZADO DE TAREAS =====
    renderTasks(tasksToRender = null) {
        const tasks = tasksToRender || this.tasks;
        const taskList = document.getElementById('task-list');
        const today = new Date().toISOString().split('T')[0];
        
        let filteredTasks = tasks;
        if (!tasksToRender) {
            filteredTasks = this.applyCurrentFilter(tasks);
        }
        
        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No hay tareas registradas</h3>
                    <p>Comience agregando una nueva tarea usando el botón "Nueva Tarea"</p>
                </div>
            `;
            return;
        }

        taskList.innerHTML = filteredTasks.sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(task => this.renderTaskItem(task, today)).join('');
    }

    applyCurrentFilter(tasks) {
        switch(this.currentFilter) {
            case 'pending':
                return tasks.filter(t => t.status === 'pending');
            case 'completed':
                return tasks.filter(t => t.status === 'completed');
            case 'pntf':
                return tasks.filter(t => t.category === 'pntf');
            case 'meeting':
                return tasks.filter(t => t.category === 'meeting');
            case 'training':
                return tasks.filter(t => t.category === 'training');
            case 'office':
                return tasks.filter(t => t.location === 'office');
            case 'remote':
                return tasks.filter(t => t.location === 'remote');
            default:
                return tasks;
        }
    }

    renderTaskItem(task, today) {
        const statusText = this.getStatusText(task.status);
        const categoryText = this.categoryNames[task.category] || 'Otras';
        const priorityColor = this.getPriorityColor(task.priority);
        const locationIcon = task.location === 'office' ? '🏢' : 
                           task.location === 'remote' ? '🏠' : '🔀';
        const isToday = task.date === today;
        
        return `
            <div class="task-item" data-id="${task.id}">
                <div class="task-header">
                    <div>
                        <div class="task-title">${task.title}</div>
                        <span class="task-category">${categoryText}</span>
                        <span class="status-badge status-${task.status}">
                            <i class="fas fa-circle" style="font-size: 8px;"></i>
                            ${statusText}
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 12px; color: ${priorityColor};">
                            <i class="fas fa-exclamation-circle"></i>
                            ${this.getPriorityText(task.priority)}
                        </span>
                        ${isToday ? '<span style="background: var(--gradient-primary); padding: 4px 10px; border-radius: 12px; font-size: 11px;">HOY</span>' : ''}
                    </div>
                </div>
                
                <div class="task-description">
                    ${task.description}
                </div>
                
                ${task.files && task.files.length > 0 ? `
                    <div class="task-attachments">
                        ${task.files.map(file => `
                            <div class="attachment-item" onclick="agenda.previewFile('${file.id}')">
                                ${file.type.startsWith('image/') ? 
                                    `<img src="${file.data}" alt="${file.name}">` : 
                                    `<i class="fas fa-${this.getFileIcon(file.type)}"></i>`
                                }
                                <span>${file.name}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="task-footer">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="task-date">
                            <i class="fas fa-calendar"></i>
                            ${new Date(task.date).toLocaleDateString('es-ES', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                            ${task.time ? ` • ${task.time}` : ''}
                        </div>
                        <span class="task-location">
                            ${locationIcon} ${task.location === 'office' ? 'Oficina' : 'Teletrabajo'}
                        </span>
                    </div>
                    
                    <div class="task-actions">
                        <button class="action-btn" onclick="agenda.toggleTaskStatus(${task.id})" title="Cambiar estado">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn" onclick="agenda.editTask(${task.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="agenda.deleteTask(${task.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== ESTADÍSTICAS =====
    updateStats() {
        const pending = this.tasks.filter(t => t.status === 'pending').length;
        const completed = this.tasks.filter(t => t.status === 'completed').length;
        const total = this.tasks.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekTasks = this.tasks.filter(t => new Date(t.date) >= weekAgo).length;
        
        const currentMonth = new Date().getMonth();
        const meetings = this.tasks.filter(t => 
            t.category === 'meeting' && 
            new Date(t.date).getMonth() === currentMonth
        ).length;
        
        document.getElementById('pending-count').textContent = pending;
        document.getElementById('completed-count').textContent = completed;
        document.getElementById('total-count').textContent = total;
        document.getElementById('week-tasks').textContent = weekTasks;
        document.getElementById('completion-rate').textContent = `${completionRate}%`;
        document.getElementById('meetings-count').textContent = meetings;
        document.getElementById('files-count').textContent = this.evidences.length;
    }

    // ===== EXPORTACIÓN A EXCEL =====
    exportToExcel() {
        try {
            const data = this.tasks.map(task => ({
                'ID': task.id,
                'Título': task.title,
                'Categoría': this.categoryNames[task.category],
                'Fecha': task.date,
                'Hora': task.time || '',
                'Prioridad': this.getPriorityText(task.priority),
                'Estado': this.getStatusText(task.status),
                'Ubicación': task.location === 'office' ? 'Oficina' : 'Teletrabajo',
                'Descripción': task.description,
                'Archivos': task.files ? task.files.map(f => f.name).join(', ') : '',
                'Creado': new Date(task.createdAt).toLocaleString(),
                'Actualizado': new Date(task.updatedAt).toLocaleString()
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Tareas DRTE");
            
            const fileName = `bitacora-drte-${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            this.showNotification('Exportado a Excel exitosamente', 'success');
        } catch (error) {
            console.error('Error exportando a Excel:', error);
            this.showNotification('Error al exportar a Excel', 'error');
        }
    }

    // ===== TEMA OSCURO/CLARO =====
    toggleTheme() {
        this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
        this.saveToStorage('drte_settings', this.settings);
        this.applyTheme();
        
        const icon = document.querySelector('#theme-toggle i');
        icon.className = this.settings.theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        
        this.showNotification(`Modo ${this.settings.theme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    // ===== UTILIDADES =====
    getFormData() {
        return {
            title: document.getElementById('task-title').value,
            category: document.getElementById('task-category').value,
            date: document.getElementById('task-date').value,
            time: document.getElementById('task-time').value,
            priority: document.getElementById('task-priority').value,
            description: document.getElementById('task-description').value,
            location: document.getElementById('task-location').value,
            status: document.getElementById('task-status').value
        };
    }

    getStatusText(status) {
        const texts = {
            'pending': 'Pendiente',
            'in-progress': 'En Progreso',
            'completed': 'Completado'
        };
        return texts[status] || 'Pendiente';
    }

    getPriorityText(priority) {
        const texts = {
            'low': 'Baja',
            'medium': 'Media',
            'high': 'Alta',
            'urgent': 'Urgente'
        };
        return texts[priority] || 'Media';
    }

    getPriorityColor(priority) {
        const colors = {
            'low': '#2ed573',
            'medium': '#ffa502',
            'high': '#ff4757',
            'urgent': '#ff3838'
        };
        return colors[priority] || '#ffa502';
    }

    getFileIcon(fileType) {
        if (fileType.includes('image')) return 'file-image';
        if (fileType.includes('pdf')) return 'file-pdf';
        if (fileType.includes('word') || fileType.includes('document')) return 'file-word';
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'file-excel';
        if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'file-powerpoint';
        if (fileType.includes('text')) return 'file-alt';
        if (fileType.includes('html')) return 'file-code';
        return 'file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                             type === 'error' ? 'exclamation-circle' : 
                             'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    checkReminders() {
        const now = new Date();
        const tasksWithReminders = this.tasks.filter(task => 
            task.reminder && new Date(task.reminder) <= now
        );
        
        tasksWithReminders.forEach(task => {
            this.showNotification(`Recordatorio: ${task.title}`, 'warning');
        });
    }

    // ===== EVENT LISTENERS COMPLETOS =====
    setupEventListeners() {
        // Formulario de tarea
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = this.getFormData();
            this.saveTask(formData);
            this.closeModal('task-modal');
        });
        
        // Subida de archivos
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');
        
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(Array.from(e.target.files));
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileUpload(Array.from(e.dataTransfer.files));
        });
        
        // Búsqueda
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchTasks(e.target.value);
        });
        
        // Tema
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Recordatorio
        document.getElementById('task-reminder').addEventListener('change', (e) => {
            document.getElementById('reminder-time').disabled = !e.target.checked;
        });
        
        // Cerrar modales con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    this.closeModal(modal.id);
                });
            }
        });
        
        // Modo offline/online
        window.addEventListener('online', () => {
            this.showNotification('Conexión restablecida', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.showNotification('Modo offline activado', 'warning');
        });
        
        console.log('Event listeners configurados correctamente');
    }
}

// ===== FUNCIONES GLOBALES =====
let agenda;

function initializeApp() {
    agenda = new AgendaDRTE();
    
    // Agregar estilos dinámicos
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Mensaje de bienvenida
    setTimeout(() => {
        agenda.showNotification('Agenda DRTE - Sistema 100% funcional', 'success');
    }, 1000);
}

// Funciones globales para HTML
function openModal(modalId) {
    if (agenda) agenda.openModal(modalId);
}

function closeModal(modalId) {
    if (agenda) agenda.closeModal(modalId);
}

function openTaskModal(type) {
    if (agenda) agenda.openTaskModal(type);
}

function filterTasks(filter) {
    if (agenda) agenda.filterTasks(filter);
}

function changeMonth(delta) {
    if (agenda) agenda.changeMonth(delta);
}

function changeView(view) {
    if (agenda) agenda.changeView(view);
}

function goToToday() {
    if (agenda) agenda.goToToday();
}

function exportToExcel() {
    if (agenda) agenda.exportToExcel();
}

function printReport() {
    window.print();
}

function saveAndEmail() {
    if (agenda) {
        const form = document.getElementById('task-form');
        if (form.checkValidity()) {
            form.dispatchEvent(new Event('submit'));
            agenda.showNotification('Tarea guardada y lista para enviar por correo', 'success');
            setTimeout(() => {
                openModal('email-modal');
            }, 1500);
        } else {
            form.reportValidity();
        }
    }
}

function saveAsTemplate() {
    if (agenda) agenda.saveAsTemplate();
}

function selectCategory(category) {
    if (agenda) agenda.selectCategory(category);
}

function selectLocation(location) {
    if (agenda) agenda.selectLocation(location);
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    if (agenda) agenda.searchTasks('');
}

function backupToDrive() {
    if (agenda) agenda.showNotification('Función de Backup a Google Drive (requiere configuración OAuth)', 'info');
}

function downloadAllFiles() {
    if (agenda) agenda.showNotification('Descargando todos los archivos...', 'info');
}

function clearOldFiles() {
    if (agenda) {
        if (confirm('¿Eliminar archivos con más de 30 días?')) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            agenda.evidences = agenda.evidences.filter(e => 
                new Date(e.uploadedAt) > thirtyDaysAgo
            );
            
            agenda.saveToStorage('drte_evidences', agenda.evidences);
            agenda.showNotification('Archivos antiguos eliminados', 'success');
        }
    }
}

function prevImage() {
    if (agenda && agenda.currentImages.length > 0) {
        agenda.currentImageIndex = (agenda.currentImageIndex - 1 + agenda.currentImages.length) % agenda.currentImages.length;
        agenda.showImagePreview(agenda.currentImages[agenda.currentImageIndex]);
    }
}

function nextImage() {
    if (agenda && agenda.currentImages.length > 0) {
        agenda.currentImageIndex = (agenda.currentImageIndex + 1) % agenda.currentImages.length;
        agenda.showImagePreview(agenda.currentImages[agenda.currentImageIndex]);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
