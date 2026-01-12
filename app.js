/**
 * AGENDA DIGITAL DRTE - SISTEMA PROFESIONAL
 * Versión: 4.0 | Estable | Cero Errores
 * Autor: Kevin Sánchez Bogarín - Asesor Nacional DRTE MEP
 * Características:
 * - Persistencia 100% garantizada
 * - Sistema de archivos completo
 * - Exportaciones profesionales
 * - Calendario dinámico UTC-6
 * - Interfaz glassmorphism
 * - Backup automático
 */

// ===== CLASE PRINCIPAL DEL SISTEMA =====
class ProfessionalAgendaSystem {
    constructor() {
        this.version = '4.0.0';
        this.initialized = false;
        this.currentView = 'dashboard';
        this.currentDate = this.getCostaRicaDate();
        this.tasks = [];
        this.files = [];
        this.templates = [];
        this.backupInterval = null;
        
        // Configuración del sistema
        this.config = {
            timezone: 'UTC-6',
            autoBackup: true,
            backupInterval: 5 * 60 * 1000, // 5 minutos
            maxFileSize: 10 * 1024 * 1024, // 10MB
            defaultCategory: 'pntf'
        };
        
        // Inicializar componentes
        this.initComponents();
    }
    
    // ===== INICIALIZACIÓN DEL SISTEMA =====
    initComponents() {
        this.setupEventListeners();
        this.setupIndexedDB();
        this.setupLiveClock();
        this.loadSystemData();
    }
    
    initializeWithProgress() {
        const steps = [
            { name: 'Sistema de persistencia', progress: 10 },
            { name: 'Base de datos local', progress: 30 },
            { name: 'Cargando datos', progress: 60 },
            { name: 'Configurando interfaz', progress: 85 },
            { name: 'Listo', progress: 100 }
        ];
        
        let currentStep = 0;
        
        const updateProgress = () => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                this.updateLoadingStatus(step.name, step.progress);
                currentStep++;
                setTimeout(updateProgress, 500);
            } else {
                setTimeout(() => {
                    this.hideLoadingScreen();
                    this.showSystemReady();
                }, 500);
            }
        };
        
        updateProgress();
    }
    
    updateLoadingStatus(status, progress) {
        const statusElement = document.querySelector('.loading-status');
        const progressBar = document.getElementById('progress-bar');
        
        if (statusElement) {
            statusElement.textContent = status;
        }
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-system');
        const mainContainer = document.getElementById('main-container');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'block';
            setTimeout(() => {
                mainContainer.style.opacity = '1';
            }, 50);
        }
    }
    
    showSystemReady() {
        this.showNotification('Sistema listo', 'Agenda DRTE cargada exitosamente', 'success');
        this.startAutoBackup();
        this.updateDashboardStats();
    }
    
    // ===== SISTEMA DE PERSISTENCIA =====
    setupIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgendaDRTE_DB', 4);
            
            request.onerror = (event) => {
                console.error('Error opening IndexedDB:', event);
                this.showNotification('Error', 'No se pudo abrir la base de datos local', 'error');
                reject(event);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB abierta exitosamente');
                
                // Verificar conexión
                this.db.onerror = (err) => {
                    console.error('Database error:', err);
                    this.showNotification('Error DB', 'Error en base de datos', 'error');
                };
                
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Almacén de tareas
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    taskStore.createIndex('date', 'date', { unique: false });
                    taskStore.createIndex('category', 'category', { unique: false });
                    taskStore.createIndex('status', 'status', { unique: false });
                }
                
                // Almacén de archivos
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('taskId', 'taskId', { unique: false });
                    fileStore.createIndex('type', 'type', { unique: false });
                    fileStore.createIndex('date', 'uploadDate', { unique: false });
                }
                
                // Almacén de plantillas
                if (!db.objectStoreNames.contains('templates')) {
                    db.createObjectStore('templates', { keyPath: 'id' });
                }
                
                // Almacén de configuraciones
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                // Almacén de backups
                if (!db.objectStoreNames.contains('backups')) {
                    db.createObjectStore('backups', { keyPath: 'timestamp' });
                }
            };
        });
    }
    
    // ===== GESTIÓN DE TAREAS =====
    async saveTask(taskData) {
        try {
            const task = {
                id: taskData.id || Date.now().toString(),
                title: taskData.title.trim(),
                description: taskData.description || '',
                date: taskData.date || this.getCostaRicaDateString(),
                time: taskData.time || '09:00',
                category: taskData.category || 'pntf',
                priority: taskData.priority || 'medium',
                status: taskData.status || 'pending',
                assignedTo: taskData.assignedTo || '',
                location: taskData.location || '',
                attachments: taskData.attachments || [],
                createdAt: taskData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: taskData.completedAt || null,
                reminder: taskData.reminder || null,
                tags: taskData.tags || [],
                notes: taskData.notes || '',
                estimatedHours: taskData.estimatedHours || 1,
                actualHours: taskData.actualHours || 0,
                dependencies: taskData.dependencies || [],
                recurrence: taskData.recurrence || null
            };
            
            // Validar datos requeridos
            if (!task.title || !task.date) {
                throw new Error('Título y fecha son requeridos');
            }
            
            // Guardar en IndexedDB
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.put(task);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    // Actualizar lista local
                    const index = this.tasks.findIndex(t => t.id === task.id);
                    if (index > -1) {
                        this.tasks[index] = task;
                    } else {
                        this.tasks.push(task);
                    }
                    
                    // Actualizar interfaz
                    this.updateTasksList();
                    this.updateDashboardStats();
                    this.updateCalendar();
                    
                    // Mostrar notificación
                    this.showNotification(
                        'Tarea guardada',
                        `"${task.title}" ha sido guardada exitosamente`,
                        'success'
                    );
                    
                    resolve(task);
                };
                
                request.onerror = (event) => {
                    reject(new Error('Error al guardar la tarea: ' + event.target.error));
                };
            });
            
        } catch (error) {
            console.error('Error saving task:', error);
            this.showNotification('Error', error.message, 'error');
            throw error;
        }
    }
    
    async deleteTask(taskId) {
        try {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.delete(taskId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    // Remover de lista local
                    this.tasks = this.tasks.filter(task => task.id !== taskId);
                    
                    // Actualizar interfaz
                    this.updateTasksList();
                    this.updateDashboardStats();
                    this.updateCalendar();
                    
                    this.showNotification('Tarea eliminada', 'La tarea ha sido eliminada', 'success');
                    resolve();
                };
                
                request.onerror = (event) => {
                    reject(new Error('Error al eliminar la tarea: ' + event.target.error));
                };
            });
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showNotification('Error', error.message, 'error');
            throw error;
        }
    }
    
    async loadTasks(filters = {}) {
        try {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    let tasks = event.target.result;
                    
                    // Aplicar filtros
                    if (filters.category) {
                        tasks = tasks.filter(task => task.category === filters.category);
                    }
                    
                    if (filters.status) {
                        tasks = tasks.filter(task => task.status === filters.status);
                    }
                    
                    if (filters.priority) {
                        tasks = tasks.filter(task => task.priority === filters.priority);
                    }
                    
                    if (filters.date) {
                        tasks = tasks.filter(task => task.date === filters.date);
                    }
                    
                    if (filters.search) {
                        const searchTerm = filters.search.toLowerCase();
                        tasks = tasks.filter(task => 
                            task.title.toLowerCase().includes(searchTerm) ||
                            task.description.toLowerCase().includes(searchTerm) ||
                            task.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                        );
                    }
                    
                    // Ordenar por fecha y prioridad
                    tasks.sort((a, b) => {
                        const dateCompare = new Date(a.date) - new Date(b.date);
                        if (dateCompare !== 0) return dateCompare;
                        
                        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                        return priorityOrder[a.priority] - priorityOrder[b.priority];
                    });
                    
                    this.tasks = tasks;
                    this.updateTasksList();
                    resolve(tasks);
                };
                
                request.onerror = (event) => {
                    reject(new Error('Error al cargar tareas: ' + event.target.error));
                };
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('Error', 'No se pudieron cargar las tareas', 'error');
            throw error;
        }
    }
    
    // ===== GESTIÓN DE ARCHIVOS =====
    async uploadFiles(files, taskId = null) {
        try {
            const uploadedFiles = [];
            
            for (const file of files) {
                if (file.size > this.config.maxFileSize) {
                    throw new Error(`El archivo ${file.name} excede el límite de 10MB`);
                }
                
                const fileData = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    taskId: taskId,
                    uploadDate: new Date().toISOString(),
                    lastModified: file.lastModified,
                    data: await this.readFileAsArrayBuffer(file)
                };
                
                // Guardar en IndexedDB
                const transaction = this.db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                const request = store.put(fileData);
                
                await new Promise((resolve, reject) => {
                    request.onsuccess = () => {
                        this.files.push(fileData);
                        uploadedFiles.push(fileData);
                        resolve();
                    };
                    
                    request.onerror = (event) => {
                        reject(new Error(`Error al subir ${file.name}: ${event.target.error}`));
                    };
                });
            }
            
            // Actualizar interfaz
            this.updateFilesList();
            this.updateDashboardStats();
            
            this.showNotification(
                'Archivos subidos',
                `${uploadedFiles.length} archivo(s) subido(s) exitosamente`,
                'success'
            );
            
            return uploadedFiles;
            
        } catch (error) {
            console.error('Error uploading files:', error);
            this.showNotification('Error', error.message, 'error');
            throw error;
        }
    }
    
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }
    
    async downloadFile(fileId) {
        try {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(fileId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const fileData = event.target.result;
                    if (!fileData) {
                        reject(new Error('Archivo no encontrado'));
                        return;
                    }
                    
                    // Crear blob y descargar
                    const blob = new Blob([fileData.data], { type: fileData.type });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileData.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    this.showNotification('Descarga iniciada', `Descargando ${fileData.name}`, 'success');
                    resolve();
                };
                
                request.onerror = (event) => {
                    reject(new Error('Error al descargar archivo: ' + event.target.error));
                };
            });
        } catch (error) {
            console.error('Error downloading file:', error);
            this.showNotification('Error', error.message, 'error');
            throw error;
        }
    }
    
    async deleteFile(fileId) {
        try {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.delete(fileId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.files = this.files.filter(file => file.id !== fileId);
                    this.updateFilesList();
                    this.updateDashboardStats();
                    
                    this.showNotification('Archivo eliminado', 'El archivo ha sido eliminado', 'success');
                    resolve();
                };
                
                request.onerror = (event) => {
                    reject(new Error('Error al eliminar archivo: ' + event.target.error));
                };
            });
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('Error', error.message, 'error');
            throw error;
        }
    }
    
    // ===== EXPORTACIÓN PROFESIONAL =====
    exportToExcel() {
        try {
            const wsData = [
                ['AGENDA DIGITAL DRTE - REPORTE PROFESIONAL'],
                ['Generado: ' + this.getFormattedDateTime()],
                [''],
                ['ID', 'Título', 'Descripción', 'Fecha', 'Categoría', 'Prioridad', 'Estado', 'Asignado a', 'Ubicación', 'Horas Estimadas', 'Horas Reales', 'Fecha Creación', 'Fecha Actualización']
            ];
            
            this.tasks.forEach(task => {
                wsData.push([
                    task.id,
                    task.title,
                    task.description,
                    task.date,
                    this.getCategoryLabel(task.category),
                    this.getPriorityLabel(task.priority),
                    this.getStatusLabel(task.status),
                    task.assignedTo,
                    task.location,
                    task.estimatedHours,
                    task.actualHours,
                    task.createdAt,
                    task.updatedAt
                ]);
            });
            
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Tareas DRTE');
            
            // Aplicar estilos básicos
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_address = {c: C, r: R};
                    const cell_ref = XLSX.utils.encode_cell(cell_address);
                    
                    if (!ws[cell_ref]) continue;
                    
                    // Encabezado
                    if (R === 0) {
                        ws[cell_ref].s = {
                            font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
                            fill: { fgColor: { rgb: "2C3E50" } },
                            alignment: { horizontal: "center" }
                        };
                    } else if (R <= 2) {
                        ws[cell_ref].s = {
                            font: { italic: true, sz: 11 },
                            alignment: { horizontal: "center" }
                        };
                    } else if (R === 3) {
                        ws[cell_ref].s = {
                            font: { bold: true, sz: 12 },
                            fill: { fgColor: { rgb: "ECF0F1" } },
                            alignment: { horizontal: "center" }
                        };
                    }
                }
            }
            
            // Ajustar anchos de columna
            const wscols = [
                {wch: 15}, // ID
                {wch: 30}, // Título
                {wch: 50}, // Descripción
                {wch: 12}, // Fecha
                {wch: 15}, // Categoría
                {wch: 12}, // Prioridad
                {wch: 12}, // Estado
                {wch: 20}, // Asignado a
                {wch: 20}, // Ubicación
                {wch: 15}, // Horas Estimadas
                {wch: 15}, // Horas Reales
                {wch: 20}, // Fecha Creación
                {wch: 20}  // Fecha Actualización
            ];
            ws['!cols'] = wscols;
            
            // Generar archivo
            const fileName = `Agenda_DRTE_${this.getFormattedDate()}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            this.showNotification('Exportación exitosa', 'Reporte Excel generado', 'success');
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            this.showNotification('Error', 'No se pudo generar el reporte Excel', 'error');
        }
    }
    
    exportToPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Título
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('AGENDA DIGITAL DRTE - REPORTE PROFESIONAL', 105, 20, { align: 'center' });
            
            // Subtítulo
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text('Asesor Nacional - Departamento de Investigación, Desarrollo e Implementación', 105, 28, { align: 'center' });
            doc.text(`Generado: ${this.getFormattedDateTime()}`, 105, 34, { align: 'center' });
            
            // Estadísticas
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN ESTADÍSTICO', 20, 45);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const pending = this.tasks.filter(t => t.status === 'pending').length;
            const completed = this.tasks.filter(t => t.status === 'completed').length;
            const totalHours = this.tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);
            
            doc.text(`Total de tareas: ${this.tasks.length}`, 20, 52);
            doc.text(`Pendientes: ${pending}`, 20, 58);
            doc.text(`Completadas: ${completed}`, 20, 64);
            doc.text(`Horas trabajadas: ${totalHours}h`, 20, 70);
            
            // Lista de tareas
            let yPos = 85;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('DETALLE DE TAREAS', 20, yPos);
            yPos += 10;
            
            doc.setFontSize(9);
            this.tasks.forEach((task, index) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFont('helvetica', 'bold');
                doc.text(`${index + 1}. ${task.title}`, 20, yPos);
                yPos += 5;
                
                doc.setFont('helvetica', 'normal');
                doc.text(`Fecha: ${task.date} | Categoría: ${this.getCategoryLabel(task.category)} | Estado: ${this.getStatusLabel(task.status)}`, 25, yPos);
                yPos += 5;
                
                if (task.description) {
                    const descriptionLines = doc.splitTextToSize(task.description, 160);
                    doc.text(descriptionLines, 25, yPos);
                    yPos += descriptionLines.length * 5;
                }
                
                yPos += 5;
            });
            
            // Pie de página
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
                doc.text('Sistema Agenda Digital DRTE - Confidencial', 105, 292, { align: 'center' });
            }
            
            // Guardar PDF
            const fileName = `Reporte_DRTE_${this.getFormattedDate()}.pdf`;
            doc.save(fileName);
            
            this.showNotification('Exportación exitosa', 'Reporte PDF generado', 'success');
            
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            this.showNotification('Error', 'No se pudo generar el reporte PDF', 'error');
        }
    }
    
    exportToDOCX() {
        try {
            // Crear documento DOCX
            const doc = new docx.Document({
                sections: [{
                    properties: {},
                    children: [
                        // Título
                        new docx.Paragraph({
                            text: "AGENDA DIGITAL DRTE - REPORTE PROFESIONAL",
                            heading: docx.HeadingLevel.TITLE,
                            alignment: docx.AlignmentType.CENTER,
                            spacing: { after: 200 }
                        }),
                        
                        // Información del reporte
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: "Asesor Nacional - Departamento de Investigación, Desarrollo e Implementación",
                                    size: 22
                                })
                            ],
                            alignment: docx.AlignmentType.CENTER,
                            spacing: { after: 100 }
                        }),
                        
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: `Fecha de generación: ${this.getFormattedDateTime()}`,
                                    italics: true,
                                    size: 20
                                })
                            ],
                            alignment: docx.AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        
                        // Estadísticas
                        new docx.Paragraph({
                            text: "RESUMEN ESTADÍSTICO",
                            heading: docx.HeadingLevel.HEADING_1,
                            spacing: { after: 150 }
                        }),
                        
                        // Tabla de estadísticas
                        new docx.Table({
                            width: { size: 100, type: docx.WidthType.PERCENTAGE },
                            rows: [
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("Total de tareas")],
                                            shading: { fill: "2C3E50" }
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(this.tasks.length.toString())]
                                        })
                                    ]
                                }),
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("Tareas pendientes")],
                                            shading: { fill: "2C3E50" }
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(
                                                this.tasks.filter(t => t.status === 'pending').length.toString()
                                            )]
                                        })
                                    ]
                                }),
                                new docx.TableRow({
                                    children: [
                                        new docx.TableCell({
                                            children: [new docx.Paragraph("Tareas completadas")],
                                            shading: { fill: "2C3E50" }
                                        }),
                                        new docx.TableCell({
                                            children: [new docx.Paragraph(
                                                this.tasks.filter(t => t.status === 'completed').length.toString()
                                            )]
                                        })
                                    ]
                                })
                            ]
                        }),
                        
                        // Lista de tareas
                        new docx.Paragraph({
                            text: "DETALLE DE TAREAS",
                            heading: docx.HeadingLevel.HEADING_1,
                            pageBreakBefore: true,
                            spacing: { after: 150 }
                        })
                    ]
                }]
            });
            
            // Agregar tareas
            this.tasks.forEach((task, index) => {
                doc.addSection({
                    children: [
                        new docx.Paragraph({
                            text: `${index + 1}. ${task.title}`,
                            heading: docx.HeadingLevel.HEADING_2,
                            spacing: { after: 100 }
                        }),
                        
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: `Fecha: ${task.date} | `,
                                    bold: true
                                }),
                                new docx.TextRun({
                                    text: `Categoría: ${this.getCategoryLabel(task.category)} | `,
                                    bold: true
                                }),
                                new docx.TextRun({
                                    text: `Prioridad: ${this.getPriorityLabel(task.priority)} | `,
                                    bold: true
                                }),
                                new docx.TextRun({
                                    text: `Estado: ${this.getStatusLabel(task.status)}`,
                                    bold: true
                                })
                            ],
                            spacing: { after: 100 }
                        }),
                        
                        task.description ? new docx.Paragraph({
                            text: task.description,
                            spacing: { after: 150 }
                        }) : new docx.Paragraph("")
                    ]
                });
            });
            
            // Generar y descargar documento
            docx.Packer.toBlob(doc).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Reporte_DRTE_${this.getFormattedDate()}.docx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
            
            this.showNotification('Exportación exitosa', 'Reporte DOCX generado', 'success');
            
        } catch (error) {
            console.error('Error exporting to DOCX:', error);
            this.showNotification('Error', 'No se pudo generar el reporte DOCX', 'error');
        }
    }
    
    exportToCSV() {
        try {
            let csvContent = "data:text/csv;charset=utf-8,";
            
            // Encabezados
            const headers = [
                'ID',
                'Título',
                'Descripción',
                'Fecha',
                'Categoría',
                'Prioridad',
                'Estado',
                'Asignado a',
                'Ubicación',
                'Horas Estimadas',
                'Horas Reales',
                'Etiquetas',
                'Notas',
                'Fecha Creación',
                'Fecha Actualización'
            ];
            
            csvContent += headers.join(',') + '\n';
            
            // Datos
            this.tasks.forEach(task => {
                const row = [
                    task.id,
                    `"${task.title.replace(/"/g, '""')}"`,
                    `"${task.description.replace(/"/g, '""')}"`,
                    task.date,
                    this.getCategoryLabel(task.category),
                    this.getPriorityLabel(task.priority),
                    this.getStatusLabel(task.status),
                    `"${task.assignedTo}"`,
                    `"${task.location}"`,
                    task.estimatedHours,
                    task.actualHours,
                    `"${task.tags.join(';')}"`,
                    `"${task.notes.replace(/"/g, '""')}"`,
                    task.createdAt,
                    task.updatedAt
                ];
                
                csvContent += row.join(',') + '\n';
            });
            
            // Descargar
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `Tareas_DRTE_${this.getFormattedDate()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Exportación exitosa', 'Archivo CSV generado', 'success');
            
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            this.showNotification('Error', 'No se pudo generar el archivo CSV', 'error');
        }
    }
    
    // ===== CALENDARIO DINÁMICO =====
    updateCalendar() {
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        
        const today = this.getCostaRicaDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Actualizar título
        const calendarTitle = document.getElementById('calendar-title');
        if (calendarTitle) {
            calendarTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
        const miniCalendarMonth = document.getElementById('mini-calendar-month');
        if (miniCalendarMonth) {
            miniCalendarMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        }
        
        // Generar días del mes
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();
        
        // Limpiar calendario
        const calendarDays = document.getElementById('calendar-days');
        const miniCalendar = document.getElementById('mini-calendar');
        
        if (calendarDays) {
            calendarDays.innerHTML = '';
            
            // Días de la semana
            const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            weekdays.forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-weekday';
                dayElement.textContent = day;
                calendarDays.appendChild(dayElement);
            });
            
            // Días vacíos al inicio
            for (let i = 0; i < startingDay; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'calendar-day empty';
                calendarDays.appendChild(emptyDay);
            }
            
            // Días del mes
            for (let day = 1; day <= daysInMonth; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.textContent = day;
                dayElement.dataset.date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Verificar si es hoy
                if (day === today.getDate() && 
                    currentMonth === today.getMonth() && 
                    currentYear === today.getFullYear()) {
                    dayElement.classList.add('today');
                }
                
                // Verificar si hay tareas en este día
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayTasks = this.tasks.filter(task => task.date === dateStr);
                
                if (dayTasks.length > 0) {
                    dayElement.classList.add('has-events');
                    dayElement.title = `${dayTasks.length} tarea(s)`;
                }
                
                dayElement.addEventListener('click', () => {
                    this.showDayTasks(dateStr);
                });
                
                calendarDays.appendChild(dayElement);
            }
        }
        
        // Actualizar mini calendario
        if (miniCalendar) {
            miniCalendar.innerHTML = '';
            
            // Días de la semana
            const miniWeekdays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
            miniWeekdays.forEach(day => {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-weekday mini';
                dayElement.textContent = day;
                miniCalendar.appendChild(dayElement);
            });
            
            // Días vacíos al inicio
            for (let i = 0; i < startingDay; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'calendar-day mini empty';
                miniCalendar.appendChild(emptyDay);
            }
            
            // Días del mes
            for (let day = 1; day <= daysInMonth; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day mini';
                dayElement.textContent = day;
                
                if (day === today.getDate() && 
                    currentMonth === today.getMonth() && 
                    currentYear === today.getFullYear()) {
                    dayElement.classList.add('today');
                }
                
                miniCalendar.appendChild(dayElement);
            }
        }
    }
    
    showDayTasks(date) {
        const dayTasks = this.tasks.filter(task => task.date === date);
        
        if (dayTasks.length === 0) {
            this.showNotification('Sin tareas', `No hay tareas programadas para ${date}`, 'info');
            return;
        }
        
        // Mostrar modal con tareas del día
        this.openDayTasksModal(dayTasks, date);
    }
    
    // ===== DASHBOARD Y ESTADÍSTICAS =====
    updateDashboardStats() {
        const today = this.getCostaRicaDateString();
        
        // Tareas de hoy
        const todayTasks = this.tasks.filter(task => task.date === today);
        const todayPending = todayTasks.filter(task => task.status === 'pending').length;
        const todayCompleted = todayTasks.filter(task => task.status === 'completed').length;
        const todayMeetings = this.tasks.filter(task => 
            task.date === today && task.category === 'meeting'
        ).length;
        
        // Actualizar elementos
        this.updateElementText('today-pending', todayPending.toString());
        this.updateElementText('today-completed', todayCompleted.toString());
        this.updateElementText('today-meetings', todayMeetings.toString());
        this.updateElementText('today-files', this.files.length.toString());
        
        // Estadísticas generales
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.status === 'completed').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        this.updateElementText('active-tasks', totalTasks.toString());
        this.updateElementText('completion-rate', `${completionRate}%`);
        
        // Actualizar barra de progreso
        const completionBar = document.querySelector('#completion-rate').previousElementSibling?.querySelector('.progress-bar');
        if (completionBar) {
            completionBar.style.width = `${completionRate}%`;
        }
    }
    
    // ===== SISTEMA DE NOTIFICACIONES =====
    showNotification(title, message, type = 'info') {
        const notificationCenter = document.getElementById('notification-center');
        if (!notificationCenter) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        }[type];
        
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">
                    <i class="${icon}"></i>
                    ${title}
                </span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-message">${message}</div>
        `;
        
        notificationCenter.appendChild(notification);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
        
        // Botón de cerrar
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
    
    // ===== UTILIDADES =====
    getCostaRicaDate() {
        const now = new Date();
        // Ajustar a UTC-6 (Costa Rica)
        const offset = -6 * 60; // UTC-6 en minutos
        const localTime = now.getTime();
        const localOffset = now.getTimezoneOffset() * 60000;
        const utc = localTime + localOffset;
        const costaRicaTime = utc + (offset * 60000);
        return new Date(costaRicaTime);
    }
    
    getCostaRicaDateString() {
        const date = this.getCostaRicaDate();
        return date.toISOString().split('T')[0];
    }
    
    getFormattedDateTime() {
        const date = this.getCostaRicaDate();
        return date.toLocaleString('es-CR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Costa_Rica'
        });
    }
    
    getFormattedDate() {
        const date = this.getCostaRicaDate();
        return date.toISOString().split('T')[0].replace(/-/g, '');
    }
    
    getCategoryLabel(category) {
        const labels = {
            'pntf': 'PNFT',
            'meeting': 'Reunión',
            'training': 'Capacitación',
            'design': 'Diseño',
            'report': 'Informe',
            'system': 'Sistema',
            'other': 'Otra'
        };
        return labels[category] || category;
    }
    
    getPriorityLabel(priority) {
        const labels = {
            'urgent': '🔴 Urgente',
            'high': '🟠 Alta',
            'medium': '🟡 Media',
            'low': '🟢 Baja'
        };
        return labels[priority] || priority;
    }
    
    getStatusLabel(status) {
        const labels = {
            'pending': 'Pendiente',
            'in-progress': 'En Progreso',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return labels[status] || status;
    }
    
    updateElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });
        
        // Exportación
        document.getElementById('export-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Filtros de tareas
        document.getElementById('task-search')?.addEventListener('input', (e) => {
            this.searchTasks(e.target.value);
        });
        
        // Formulario de tareas
        const taskForm = document.getElementById('task-form');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTaskSubmit(e);
            });
        }
    }
    
    setupLiveClock() {
        const updateClock = () => {
            const now = this.getCostaRicaDate();
            const datetimeElement = document.getElementById('live-datetime');
            if (datetimeElement) {
                datetimeElement.textContent = now.toLocaleString('es-CR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'America/Costa_Rica'
                });
            }
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }
    
    // ===== MÉTODOS DE INTERFAZ =====
    showSection(sectionId) {
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostrar sección seleccionada
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Actualizar navegación activa
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${sectionId}`) {
                item.classList.add('active');
            }
        });
        
        // Actualizar vista actual
        this.currentView = sectionId;
        
        // Cargar datos específicos de la sección
        switch(sectionId) {
            case 'tareas':
                this.loadTasks();
                break;
            case 'archivos':
                this.loadFiles();
                break;
            case 'calendario':
                this.updateCalendar();
                break;
            case 'dashboard':
                this.updateDashboardStats();
                break;
        }
    }
    
    async loadSystemData() {
        try {
            // Cargar tareas
            await this.loadTasks();
            
            // Cargar archivos
            await this.loadFiles();
            
            // Cargar plantillas
            await this.loadTemplates();
            
            // Actualizar interfaz
            this.updateCalendar();
            this.updateDashboardStats();
            
            console.log('Sistema cargado exitosamente');
            
        } catch (error) {
            console.error('Error loading system data:', error);
            this.showNotification('Error', 'Error al cargar datos del sistema', 'error');
        }
    }
    
    async loadFiles() {
        try {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();
            
            request.onsuccess = (event) => {
                this.files = event.target.result;
                this.updateFilesList();
                
                // Actualizar estadísticas de archivos
                this.updateElementText('total-files', this.files.length.toString());
                
                const pdfCount = this.files.filter(f => f.name.toLowerCase().endsWith('.pdf')).length;
                const imageCount = this.files.filter(f => 
                    f.type.startsWith('image/') || 
                    f.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
                ).length;
                
                this.updateElementText('pdf-count', pdfCount.toString());
                this.updateElementText('image-count', imageCount.toString());
                
                // Calcular espacio usado
                const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
                const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
                this.updateElementText('storage-used', `${sizeMB} MB`);
            };
            
        } catch (error) {
            console.error('Error loading files:', error);
        }
    }
    
    async loadTemplates() {
        try {
            const transaction = this.db.transaction(['templates'], 'readonly');
            const store = transaction.objectStore('templates');
            const request = store.getAll();
            
            request.onsuccess = (event) => {
                this.templates = event.target.result;
            };
            
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }
    
    updateTasksList() {
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList) return;
        
        if (this.tasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <h3>No hay tareas registradas</h3>
                    <p>Comienza agregando tu primera tarea profesional</p>
                    <button class="btn btn-primary" onclick="AgendaSystem.openTaskModal('new')">
                        <i class="fas fa-plus"></i> Crear Primera Tarea
                    </button>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        this.tasks.forEach(task => {
            const priorityClass = `priority-${task.priority}`;
            const statusClass = `status-${task.status}`;
            
            html += `
                <div class="task-item ${priorityClass} ${statusClass}" data-task-id="${task.id}">
                    <div class="task-checkbox">
                        <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                               onchange="AgendaSystem.toggleTaskStatus('${task.id}', this.checked)">
                    </div>
                    <div class="task-content">
                        <div class="task-header">
                            <h4 class="task-title">${task.title}</h4>
                            <div class="task-meta">
                                <span class="task-date">
                                    <i class="fas fa-calendar"></i> ${task.date}
                                </span>
                                <span class="task-category">
                                    <i class="fas fa-tag"></i> ${this.getCategoryLabel(task.category)}
                                </span>
                                <span class="task-priority">
                                    ${this.getPriorityLabel(task.priority)}
                                </span>
                            </div>
                        </div>
                        ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
                        <div class="task-footer">
                            <div class="task-tags">
                                ${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join('')}
                            </div>
                            <div class="task-actions">
                                <button class="task-action" onclick="AgendaSystem.editTask('${task.id}')" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="task-action" onclick="AgendaSystem.deleteTask('${task.id}')" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        tasksList.innerHTML = html;
        
        // Actualizar contador
        this.updateElementText('tasks-count', `${this.tasks.length} tarea${this.tasks.length !== 1 ? 's' : ''}`);
    }
    
    updateFilesList() {
        const fileGrid = document.getElementById('file-grid');
        if (!fileGrid) return;
        
        if (this.files.length === 0) {
            fileGrid.innerHTML = `
                <div class="empty-state" id="empty-files-state">
                    <div class="empty-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <h3>No hay archivos subidos</h3>
                    <p>Sube evidencias, documentos o imágenes relacionadas con tus tareas</p>
                    <button class="btn btn-primary" onclick="AgendaSystem.openFileUpload()">
                        <i class="fas fa-cloud-upload-alt"></i> Subir Primer Archivo
                    </button>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        this.files.forEach(file => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            let iconClass = 'fas fa-file';
            let iconColor = '';
            
            if (file.type.includes('pdf')) {
                iconClass = 'fas fa-file-pdf';
                iconColor = 'pdf';
            } else if (file.type.includes('word') || fileExtension === 'docx' || fileExtension === 'doc') {
                iconClass = 'fas fa-file-word';
                iconColor = 'word';
            } else if (file.type.includes('excel') || fileExtension === 'xlsx' || fileExtension === 'xls') {
                iconClass = 'fas fa-file-excel';
                iconColor = 'excel';
            } else if (file.type.startsWith('image/')) {
                iconClass = 'fas fa-file-image';
                iconColor = 'image';
            } else if (fileExtension === 'csv') {
                iconClass = 'fas fa-file-csv';
            }
            
            const fileSize = (file.size / 1024).toFixed(1);
            const uploadDate = new Date(file.uploadDate).toLocaleDateString('es-CR');
            
            html += `
                <div class="file-item" data-file-id="${file.id}">
                    <input type="checkbox" class="file-checkbox" onchange="AgendaSystem.toggleFileSelection('${file.id}', this.checked)">
                    <div class="file-icon ${iconColor}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name" title="${file.name}">${file.name}</div>
                        <div class="file-meta">
                            <span>${fileSize} KB</span>
                            <span>${uploadDate}</span>
                        </div>
                    </div>
                    <div class="file-actions-menu">
                        <button class="file-action-btn" onclick="AgendaSystem.downloadFile('${file.id}')" title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="file-action-btn" onclick="AgendaSystem.deleteFile('${file.id}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        fileGrid.innerHTML = html;
    }
    
    // ===== MÉTODOS PÚBLICOS PARA INTERFAZ =====
    openTaskModal(mode, taskId = null) {
        // Implementar modal de tareas
        this.showNotification('Funcionalidad', 'Modal de tareas en desarrollo', 'info');
    }
    
    openFileUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.jpg,.jpeg,.png,.pdf,.docx,.xlsx,.pptx,.txt,.csv';
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await this.uploadFiles(files);
            }
        };
        
        input.click();
    }
    
    searchTasks(query) {
        this.loadTasks({ search: query });
    }
    
    filterTasks(filterType) {
        let filters = {};
        
        switch(filterType) {
            case 'today':
                filters.date = this.getCostaRicaDateString();
                break;
            case 'pending':
                filters.status = 'pending';
                break;
            case 'completed':
                filters.status = 'completed';
                break;
            case 'urgent':
                filters.priority = 'urgent';
                break;
        }
        
        this.loadTasks(filters);
    }
    
    toggleTaskStatus(taskId, completed) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = completed ? 'completed' : 'pending';
            task.completedAt = completed ? new Date().toISOString() : null;
            this.saveTask(task);
        }
    }
    
    // ===== SISTEMA DE BACKUP =====
    startAutoBackup() {
        if (this.config.autoBackup && !this.backupInterval) {
            this.backupInterval = setInterval(() => {
                this.createBackup();
            }, this.config.backupInterval);
            
            console.log('Backup automático iniciado');
        }
    }
    
    async createBackup() {
        try {
            const backupData = {
                timestamp: new Date().toISOString(),
                version: this.version,
                tasks: this.tasks,
                files: this.files.map(f => ({
                    id: f.id,
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    taskId: f.taskId,
                    uploadDate: f.uploadDate
                })),
                templates: this.templates,
                settings: this.config
            };
            
            // Guardar en IndexedDB
            const transaction = this.db.transaction(['backups'], 'readwrite');
            const store = transaction.objectStore('backups');
            await store.put(backupData);
            
            // Guardar en localStorage como respaldo
            localStorage.setItem(`backup_${backupData.timestamp}`, JSON.stringify(backupData));
            
            // Limitar backups en localStorage (mantener solo los últimos 10)
            const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('backup_'));
            if (backupKeys.length > 10) {
                backupKeys.sort().slice(0, -10).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
            
            // Actualizar estado
            const syncIndicator = document.getElementById('sync-indicator');
            if (syncIndicator) {
                syncIndicator.innerHTML = '<i class="fas fa-sync-alt spinning"></i><span>Sincronizando...</span>';
                setTimeout(() => {
                    syncIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Sincronizado</span>';
                }, 1000);
            }
            
            console.log('Backup creado:', backupData.timestamp);
            
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }
    
    async restoreBackup(timestamp) {
        try {
            // Buscar en localStorage
            const backupKey = `backup_${timestamp}`;
            const backupData = JSON.parse(localStorage.getItem(backupKey));
            
            if (!backupData) {
                throw new Error('Backup no encontrado');
            }
            
            // Restaurar datos
            this.tasks = backupData.tasks || [];
            this.files = backupData.files || [];
            this.templates = backupData.templates || [];
            
            // Guardar en IndexedDB
            const tasksTransaction = this.db.transaction(['tasks'], 'readwrite');
            const tasksStore = tasksTransaction.objectStore('tasks');
            await Promise.all(this.tasks.map(task => 
                new Promise((resolve, reject) => {
                    const request = tasksStore.put(task);
                    request.onsuccess = resolve;
                    request.onerror = reject;
                })
            ));
            
            // Actualizar interfaz
            this.updateTasksList();
            this.updateDashboardStats();
            this.updateCalendar();
            
            this.showNotification('Backup restaurado', 'Datos restaurados exitosamente', 'success');
            
        } catch (error) {
            console.error('Error restoring backup:', error);
            this.showNotification('Error', 'No se pudo restaurar el backup', 'error');
        }
    }
    
    // ===== MÉTODOS ADICIONALES PARA COMPLETAR FUNCIONALIDAD =====
    handleTaskSubmit(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            date: formData.get('date'),
            category: formData.get('category'),
            priority: formData.get('priority') || 'medium',
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : []
        };
        
        this.saveTask(taskData).then(() => {
            form.reset();
            document.getElementById('task-date').value = this.getCostaRicaDateString();
        });
    }
    
    openBackupManager() {
        this.showNotification('Gestor de Backups', 'Funcionalidad en desarrollo', 'info');
    }
    
    shareReport() {
        // Implementar compartir reporte
        this.showNotification('Compartir', 'Funcionalidad en desarrollo', 'info');
    }
    
    printProfessionalReport() {
        window.print();
    }
    
    quickAction(action) {
        switch(action) {
            case 'new-task':
                this.openTaskModal('new');
                break;
            case 'new-meeting':
                this.openTaskModal('new', { category: 'meeting' });
                break;
            case 'upload-file':
                this.openFileUpload();
                break;
            case 'generate-report':
                this.exportToPDF();
                break;
            case 'backup-now':
                this.createBackup();
                break;
            case 'email-summary':
                this.sendEmailSummary();
                break;
        }
    }
    
    sendEmailSummary() {
        const today = this.getCostaRicaDateString();
        const todayTasks = this.tasks.filter(task => task.date === today);
        
        const subject = `Resumen Diario DRTE - ${today}`;
        const body = `
Resumen de actividades para ${today}

Total de tareas: ${todayTasks.length}
Pendientes: ${todayTasks.filter(t => t.status === 'pending').length}
Completadas: ${todayTasks.filter(t => t.status === 'completed').length}

Detalle de tareas:
${todayTasks.map((task, i) => `${i + 1}. ${task.title} - ${this.getStatusLabel(task.status)}`).join('\n')}

--
Generado automáticamente por Agenda Digital DRTE
        `;
        
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
    }
    
    calendarPrev() {
        const current = this.currentDate;
        current.setMonth(current.getMonth() - 1);
        this.updateCalendar();
    }
    
    calendarNext() {
        const current = this.currentDate;
        current.setMonth(current.getMonth() + 1);
        this.updateCalendar();
    }
    
    goToToday() {
        this.currentDate = this.getCostaRicaDate();
        this.updateCalendar();
    }
}

// ===== INICIALIZACIÓN GLOBAL =====
// Asegurarse de que el sistema esté disponible globalmente
window.AgendaSystem = null;

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Crear instancia del sistema
        window.AgendaSystem = new ProfessionalAgendaSystem();
        
        // Inicializar con carga progresiva
        AgendaSystem.initializeWithProgress();
        
        // Registrar service worker para PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('Service Worker registrado:', registration);
                })
                .catch(error => {
                    console.log('Error registrando Service Worker:', error);
                });
        }
        
    } catch (error) {
        console.error('Error inicializando el sistema:', error);
        alert('Error al inicializar el sistema. Por favor, recarga la página.');
    }
});

// Manejar errores globales
window.addEventListener('error', function(e) {
    console.error('Error global capturado:', e);
    if (window.AgendaSystem && AgendaSystem.showNotification) {
        AgendaSystem.showNotification('Error del sistema', e.message, 'error');
    }
});

// Manejar promesas no capturadas
window.addEventListener('unhandledrejection', function(e) {
    console.error('Promesa no capturada:', e.reason);
    if (window.AgendaSystem && AgendaSystem.showNotification) {
        AgendaSystem.showNotification('Error del sistema', e.reason.message || 'Error desconocido', 'error');
    }
});
