# DOCUMENTO DE REQUERIMIENTOS: TELEGRAM MARKOV BOT (PRO)

## 1. OBJETIVO

Desarrollar un bot para Telegram que genere frases basadas en el histórico de mensajes del chat utilizando Cadenas de Markov.

**Restricción de Privacidad:** El bot NO debe almacenar mensajes completos ni registros de auditoría de quién dijo qué. Solo debe persistir la relación estadística (frecuencia) entre palabras.

## 2. ARQUITECTURA DE DATOS (SQLITE)

Se utilizará SQLite para representar el grafo de estados. Cada fila representa una "arista" del grafo con un peso.

### Esquema de la Base de Datos:

```sql
CREATE TABLE IF NOT EXISTS grafo (
    palabra_a TEXT,       -- Estado actual
    palabra_b TEXT,       -- Estado siguiente
    frecuencia INTEGER DEFAULT 1, 
    PRIMARY KEY (palabra_a, palabra_b)
);

CREATE INDEX IF NOT EXISTS idx_origen ON grafo(palabra_a);
```

## 3. LÓGICA DE PROCESAMIENTO

### A. Aprendizaje (Ingesta de Datos)

Por cada mensaje de texto recibido (que no sea un comando):

1. Limpiar el texto: convertir a minúsculas, eliminar caracteres especiales innecesarios.
2. Dividir el texto en una lista de palabras (tokens).
3. Iterar sobre la lista creando pares (w1, w2).
4. Ejecutar la siguiente consulta de persistencia (Upsert):
   ```sql
   INSERT INTO grafo (palabra_a, palabra_b, frecuencia) 
   VALUES (?, ?, 1)
   ON CONFLICT(palabra_a, palabra_b) 
   DO UPDATE SET frecuencia = frecuencia + 1;
   ```

### B. Generación de Frases (Inferencia)

Cuando se invoque el comando `/markov_habla`:

1. **Inicio:** Seleccionar una `palabra_a` al azar de la tabla `grafo`.
2. **Caminata Aleatoria:**
   - Seleccionar todas las filas donde `palabra_a` coincida con la palabra actual.
   - Realizar un **muestreo probabilístico ponderado** usando la columna `frecuencia` para elegir la siguiente `palabra_b`.
3. **Continuidad:** La palabra elegida pasa a ser la nueva `palabra_a`.
4. **Finalización:** Detenerse cuando se alcancen 20 palabras o no existan más conexiones en la base de datos.

## 4. REQUISITOS NO FUNCIONALES

- **Eficiencia de Memoria:** No cargar el grafo completo en RAM; realizar consultas SQL por cada paso de la generación.
- **Escalabilidad:** El uso de índices en SQLite es obligatorio para mantener la velocidad de respuesta.
- **Tecnologías Sugeridas:** Python 3.x, `python-telegram-bot` (v20+), `sqlite3`.

## 5. INTERFAZ DE COMANDOS

- `/start`: Mensaje de bienvenida.
- `/markov_habla`: Generar y enviar una frase aleatoria basada en el conocimiento acumulado.
- `/stats`: Mostrar cuántas conexiones únicas (filas) tiene el grafo.
