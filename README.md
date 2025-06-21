# manga-ai
Proyecto MVP de recomendaciones de mangas y manhwas

Nombre de la app: MangAI

Descripción: MangAI es una página web diseñada para recomendar manga y manhwa de manera personalizada, diferenciándose de los filtros de géneros, esta plataforma utiliza Inteligencia Artificial para interpretar los gustos de cada usuario expresados en lenguaje natural.

Después de crear una cuenta con nombre de usuario único, el usuario puede describir lo que le gusta y la plataforma le devolverá una lista de títulos que coincidan con su petición.

Tecnologías: La página se construyó con JavaScript y los servicios de Google.
En FrontEnd - HTML, CSS y JavaScript
En BackEnd - Firebase Cloud Functions, Node.js y Express.js
Base de datos y autenticación - Firebase Firestore y Firebase Authentication
Como Hosting - Firebase Hosting
Apis Externas - Google Gemini API y MyAnimeList API

Estructura base de datos:
La base de datos en Firebase es

Colección: users
- ID del Documento: uid del usuario, proporcionado por Firebase Authentication.
  Campos del Documento:
   - displayName (string): 
   - email (string):
   - createdAt (timestamp):
   - searchHistory (array de objetos): Una lista que almacena cada una de las búsquedas del usuario.
      Cada objeto en el array contiene:
      - prompt (string): El texto exacto que el usuario escribió.
      - timestamp (timestamp): 

Colección: usernames
- ID del Documento: El nombre de usuario.
Propósito: verificar que no exista otro usuario igual.
   Campos del Documento:
    - userId (string):

Uso de la IA: La IA es la funcionalidad central siendo implementada como un recomendador experto.


Nota: En un futuro me gustaría implementar un sistema de biblioteca para guardar los mangas en distintas categorías y además descartar esos mangas en la búsqueda de la IA.






