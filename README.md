# 🤖 Robert Graffo Markov Bot

Un bot de Telegram que aprende a hablar como tu chat usando cadenas de Markov. Básicamente, lee todo lo que escribes y luego te responde con frases que suenan como si las hubieras escrito tú (pero más raras).

## 🎯 ¿Qué hace este bot?

1. **Escucha todo** - Cada mensaje que escribes en el chat se convierte en "bigramas" (pares de palabras) que el bot memoriza
2. **Genera frases locas** - Cuando le pides que hable, usa esos bigramas para crear frases nuevas basadas en lo que aprendió
3. **Se adapta** - Puedes ajustar qué tan predecible o aleatorio quieres que sea

## 🚀 Instalación Rápida

```bash
# Clona el repo
git clone <tu-repo>
cd robert-graffo-markov-bot

# Instala dependencias
npm install

# Crea un archivo .env con tu token de Telegram
echo "BOT_TOKEN=tu_token_aqui" > .env
echo "DB_PATH=./data/markov.sqlite" >> .env

# Opcional: Si quieres los gráficos, instala Python y las librerías
pip3 install networkx matplotlib

# ¡Ejecuta el bot!
npm start
```

## 📝 Comandos Disponibles

### Generar Frases
- `/markov_habla`, `/markov`, `/lamanito`, `/la-manito`, `/la-manito-jota`, `/jota` - Genera una frase basada en lo aprendido

### Estadísticas
- `/stats` - Muestra estadísticas del chat (palabras, bigramas, configuración)
- `/grafo` - Genera y envía una visualización del grafo de Markov
- `/palabras [número]` - Gráfico de palabras más frecuentes (default: 20)

### Configuración
- `/set_temperature <valor>` - Ajusta la temperatura (0.3 - 2.5)
  - Menor = más predecible
  - Mayor = más aleatorio
- `/start_mode <modo>` - Cambia el modo de inicio (`start|random|mix`)
- `/set_random_start_prob <valor>` - Probabilidad de inicio aleatorio en modo mix (0-1)
- `/show_settings` - Muestra la configuración actual

### Ayuda
- `/help` - Muestra todos los comandos disponibles

## 🧠 ¿Cómo Funciona?

El bot usa **cadenas de Markov** con bigramas:

1. Cuando escribes "hola como estas", el bot crea los bigramas:
   - `__START__ -> hola`
   - `hola -> como`
   - `como -> estas`
   - `estas -> __END__`

2. Al generar una frase, el bot:
   - Empieza desde `__START__` o una palabra aleatoria (según configuración)
   - Busca qué palabras pueden seguir según los bigramas aprendidos
   - Selecciona la siguiente palabra usando probabilidades ponderadas por temperatura
   - Repite hasta llegar a `__END__` o un límite de longitud

3. La **temperatura** controla qué tan "creativo" es:
   - Baja (0.3-0.7): Frases más predecibles y coherentes
   - Media (0.8-1.2): Balance entre coherencia y sorpresa
   - Alta (1.5-2.5): Frases completamente locas e impredecibles

## 💾 Datos

Todo se guarda en una base de datos SQLite en `./data/markov.sqlite`. Cada chat tiene su propio conjunto de datos aprendidos.

## ⚠️ Notas

- El bot necesita que **hablen mucho** antes de generar frases decentes. Si no hay suficientes datos, te dirá "Hablen más 😈"
- Los gráficos requieren Python con `networkx` y `matplotlib` instalados
- El bot ignora comandos (mensajes que empiezan con `/`) y otros bots

## 🎨 Ejemplo de Uso

```
Tú: hola como estas
Tú: que tal el dia
Tú: como va todo
Tú: /markov_habla

Bot: hola como va todo
```

¡Y así es como un bot aprende a hablar como tu chat! 🎉
