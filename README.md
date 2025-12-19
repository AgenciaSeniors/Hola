# D' La Vida Bar - App Updates

## 🛠️ Instalación de la Actualización

### 1. Actualizar Código Frontend
Reemplaza los archivos en la carpeta `js/` con las nuevas versiones modulares:
- `js/ai/aiEngine.js`
- `js/ai/aiUtils.js`
- `js/services/api.js`
- `js/script.js`
- `js/admin.js`

⚠️ **Cambio Crítico en HTML**:
Debes editar `index.html` y `admin.html` para soportar módulos:
```html
<script src="js/script.js"></script>
<script type="module" src="js/script.js"></script>