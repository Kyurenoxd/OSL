import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
import { exec, ExecException } from 'child_process'
import axios from 'axios'
import os from 'os'
let mainWindow: BrowserWindow
import type { Server } from '../src/types/Server'



// Получение списка серверов
async function getServerList(): Promise<Server[]> {
  try {
    const response = await axios.get<Server[]>('https://osu-server-list.com/api/v2/client/servers?key=PfGLccr8pA5nOp1')
    return response.data
  } catch (error) {
    console.error('Error fetching server list:', error)
    return []
  }
}

// Обработчик запуска osu!
ipcMain.handle('launch-osu', async (event, osuPath: string, devserver: string) => {
  try {
    if (!osuPath) {
      throw new Error('No osu! path specified')
    }

    if (!devserver) {
      throw new Error('No devserver specified')
    }

    console.log('=== Launch Debug Info ===')
    console.log('Raw osu! path:', osuPath)
    console.log('Raw devserver:', devserver)
    
    // Используем path для правильного форматирования пути
    const normalizedPath = path.normalize(osuPath)
    const workingDir = path.dirname(normalizedPath)
    
    console.log('Normalized path:', normalizedPath)
    console.log('Working directory:', workingDir)
    
    // Формируем команду с полным путем
    const command = `"${normalizedPath}" -devserver ${devserver}`
    
    console.log('Final command:', command)
    console.log('=====================')
    
    return new Promise<boolean>((resolve, reject) => {
      exec(command, {
        cwd: workingDir,
        encoding: 'utf8',
        windowsHide: true
      }, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          console.error('=== Error Details ===')
          console.error('Error launching osu!:', error)
          console.error('Error code:', error.code)
          console.error('Error signal:', error.signal)
          console.error('Error command:', error.cmd)
          console.error('stdout:', stdout)
          console.error('stderr:', stderr)
          console.error('===================')
          reject(error)
        } else {
          console.log('=== Success Details ===')
          console.log('osu! launched successfully')
          console.log('stdout:', stdout)
          console.log('=====================')
          resolve(true)
        }
      })
    })
  } catch (error) {
    console.error('=== Launch Error ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error)
    console.error('==================')
    throw error
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      devTools: false
    },
    transparent: true,
    autoHideMenuBar: true,
    show: false,
    title: 'OSL',
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: true,
    closable: true,
    resizable: false,
    skipTaskbar: false,
  })

  mainWindow.setMenu(null)
  mainWindow.removeMenu()

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.osl.app')
    mainWindow.setThumbarButtons([])
    try {
      const iconPath = path.join(__dirname, '../src/assets/images/icon.ico')
      if (require('fs').existsSync(iconPath)) {
        mainWindow.setIcon(iconPath)
      } else {
        console.warn('Icon file not found:', iconPath)
      }
    } catch (error) {
      console.error('Error setting window icon:', error)
    }
    mainWindow.setTitle('OSL')
  }

  // Предотвращение открытия DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'i') {
      event.preventDefault()
    }
  })

  // Обработчики управления окном
  ipcMain.on('minimize-window', () => mainWindow.minimize())
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('close-window', () => mainWindow.close())
  ipcMain.on('open-external', (_, url) => shell.openExternal(url))

  // Диалог выбора файла
  ipcMain.handle('dialog:openFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Executable', extensions: ['exe'] }
        ],
        title: 'Select osu!.exe'
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0]
      }
      return null
    } catch (error) {
      console.error('Dialog error:', error)
      return null
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Загрузка приложения
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// Создание ярлыка
ipcMain.handle('create-shortcut', async () => {
  try {
    if (process.platform === 'win32') {
      const desktopPath = path.join(os.homedir(), 'Desktop')
      const exePath = process.execPath
      const shortcutPath = path.join(desktopPath, 'OSL.lnk')

      await shell.writeShortcutLink(shortcutPath, {
        target: exePath,
        description: 'OSL - osu! Server List Launcher',
        icon: path.join(__dirname, '../public/logo.ico'),
        appUserModelId: 'com.osl.launcher'
      })

      return true
    }
    return false
  } catch (error) {
    console.error('Error creating shortcut:', error)
    return false
  }
})

// Инициализация приложения
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
}) 