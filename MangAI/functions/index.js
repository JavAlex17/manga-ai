
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

//Inicializar Firebase
admin.initializeApp();
const db = admin.firestore();
const app = express();

//Usar CORS para permitir peticiones desde el frontend
app.use(cors({ origin: true }));

//Autenticación con Firebase Auth
const authenticate = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return res.status(403).send('Unauthorized: No token provided.');
  }
  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized: Invalid token.');
  }
};



//Express para parsear JSON
app.use(express.json());

// --- ENDPOINTS ---

//Endpoint principal para las recomendaciones
app.post("/recommendations", authenticate, async (req, res) => {
  try {
    const { tastes, time, status } = req.body;
    const userId = req.user.uid;
    if (!tastes) {
      return res.status(400).send({ error: "El campo 'tastes' es requerido." });
    }

    //Obtiene la lista de títulos recomendados por la IA
    const recommendedTitles = await getDirectRecommendationsFromAI(tastes);
    if (!recommendedTitles || recommendedTitles.length === 0) {
      return res.status(200).send([]);
    }

    //Verifica cada título con datos de MAL
    console.log("Verificando y enriqueciendo títulos con datos de MAL...");
    const mangaPromises = recommendedTitles.map(title => searchMangaOnMAL(title));
    const verifiedMangasWithData = (await Promise.all(mangaPromises)).filter(Boolean);

    console.log(`Se encontraron datos para ${verifiedMangasWithData.length} de ${recommendedTitles.length} títulos.`);

    //Filtro de los resultados verificados según las restricciones del usuario
    let finalCandidates = verifiedMangasWithData;

    if (status && status !== "Cualquiera") {
      const malStatus = status === "Terminado" ? "finished" : "currently_publishing";
      finalCandidates = finalCandidates.filter(manga => manga.status === malStatus);
    }

    let maxChapters;
    if (time === "Poco") maxChapters = 50;
    if (time === "Medio") maxChapters = 10000;
    if (maxChapters) {
      finalCandidates = finalCandidates.filter(manga => manga.num_chapters && manga.num_chapters <= maxChapters);
    }

    console.log(`Después de aplicar filtros de usuario, quedan ${finalCandidates.length} candidatos.`);


    if (finalCandidates.length > 0) {
      const userRef = db.collection('users').doc(userId);

      const userDoc = await userRef.get();

      //Historial
      const newHistoryEntry = {
        prompt: tastes,
        timestamp: new Date()
      };

      let currentHistory = [];
      
      if (userDoc.exists && userDoc.data().searchHistory) {
        currentHistory = userDoc.data().searchHistory;
      }

      currentHistory.push(newHistoryEntry);

      await userRef.set({
        email: req.user.email,
        displayName: req.user.name,
        searchHistory: currentHistory
      }, { merge: true });

      console.log(`Historial de búsqueda actualizado para el usuario ${userId}`);
    }

    //Devuelve el top 5
    return res.status(200).send(finalCandidates.slice(0, 5));

  } catch (error) {
    console.error("Error en el endpoint de recomendación directa:", error.message);
    return res.status(500).send({ error: "Ocurrió un error en el servidor." });
  }
});


// --- FUNCIONES ---

//Función para llamar a la API de Gemini
async function getDirectRecommendationsFromAI(userTastes) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  // --- PROMPT ---
  const prompt = `
    Eres un sabio y experimentado bibliotecario de manga y manhwa con un gusto impecable. Conoces obras de todos los géneros, tanto populares como de nicho.
    Un usuario te ha hecho la siguiente petición: "${userTastes}"

    Tu tarea es recomendarle directamente entre 5 y 7 títulos de mangas o manhwas que encajen perfectamente con su petición. Piensa en la atmósfera, los temas, el estilo artístico y la narrativa. No te limites solo a los géneros obvios.

    Devuelve tu respuesta únicamente en formato de array JSON con los nombres de los títulos.
    Ejemplo de respuesta:
    ["Berserk", "Vinland Saga", "Vagabond", "Oyasumi Punpun", "20th Century Boys"]
  `;


  console.log("Pidiendo recomendaciones directas a la IA...");

  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
    }, { timeout: 30000 });

    console.log("IA respondió con una lista de títulos.");
    const rawResponse = response.data.candidates[0].content.parts[0].text;
    const jsonStringMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (!jsonStringMatch) {
      throw new Error("La respuesta de la IA no contenía un array JSON de títulos.");
    }

    const titles = JSON.parse(jsonStringMatch[0]);
    console.log("Títulos recomendados por la IA:", titles);
    return titles;

  } catch (error) {
    console.error("--- ERROR DETALLADO PIDIENDO TÍTULOS A GEMINI ---");
    throw new Error("No se pudieron obtener las recomendaciones directas de la IA.");
  }
}

//Función para buscar en la API de MyAnimeList
async function searchMangaOnMAL(title) {
  const clientId = process.env.MAL_CLIENT_ID;
  const url = "https://api.myanimelist.net/v2/manga";

  try {
    const response = await axios.get(url, {
      headers: { "X-MAL-CLIENT-ID": clientId },
      params: {
        q: title, 
        limit: 1,
        fields: "id,title,main_picture,synopsis,num_chapters,status,genres",
      },
    });

    //Si la búsqueda no encuentra nada, devuelve null
    if (!response.data.data || response.data.data.length === 0) {
      console.log(`No se encontró "${title}" en MyAnimeList.`);
      return null;
    }

    return response.data.data[0].node;

  } catch (error) {
    console.error(`Error buscando "${title}" en MAL:`, error.message);
    return null;
  }
}

//Endpoint para guardar un manga en la biblioteca del usuario
app.post("/user/:userId/manga", async (req, res) => {
  try {
    const { userId } = req.params;
    const { mangaId } = req.body;

    if (!mangaId) {
      return res.status(400).send({ error: "El campo 'mangaId' es requerido." });
    }

    const userRef = db.collection("users").doc(userId);
    await userRef.set({
      savedManga: admin.firestore.FieldValue.arrayUnion(mangaId)
    }, { merge: true });

    return res.status(200).send({ success: true, message: `Manga ${mangaId} guardado.` });

  } catch (error) {
    console.error("Error al guardar manga:", error);
    return res.status(500).send({ error: "No se pudo guardar el manga." });
  }
});


//Endpoint para obtener la biblioteca del usuario
app.get("/user/:userId/manga", async (req, res) => {
  try {
    const { userId } = req.params;
    const userRef = db.collection("users").doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(200).send({ savedManga: [] });
    }

    return res.status(200).send(doc.data());

  } catch (error) {
    console.error("Error al obtener biblioteca:", error);
    return res.status(500).send({ error: "No se pudo obtener la biblioteca." });
  }
});

//Endpoint para registrar un nuevo usuario
app.post("/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).send({ error: "Email, contraseña y nombre de usuario son requeridos." });
    }

    const normalizedDisplayName = displayName.trim().toLowerCase();
    if (normalizedDisplayName.length < 3) {
      return res.status(400).send({ error: "El nombre de usuario debe tener al menos 3 caracteres." });
    }

    const usernameRef = db.collection('usernames').doc(normalizedDisplayName);

    //Verifica si el nombre de usuario ya existe
    const usernameDoc = await usernameRef.get();
    if (usernameDoc.exists) {
      return res.status(409).send({ error: "Este nombre de usuario ya está en uso. Por favor, elige otro." }); // 409 Conflict
    }

    //Si el nombre está libre, se crea el usuario
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName.trim(),
    });

    const userRef = db.collection('users').doc(userRecord.uid);

    await db.runTransaction(async (transaction) => {
      transaction.set(userRef, {
        displayName: displayName.trim(),
        email: userRecord.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      transaction.set(usernameRef, { userId: userRecord.uid });
    });

    console.log(`Usuario ${userRecord.uid} creado exitosamente con el nombre ${displayName.trim()}`);
    return res.status(201).send({ uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName });

  } catch (error) {
    console.error("Error en el registro de usuario:", error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).send({ error: "Este correo electrónico ya está registrado." });
    }
    if (error.code === 'auth/invalid-password') {
      return res.status(400).send({ error: "La contraseña debe tener al menos 6 caracteres." });
    }
    return res.status(500).send({ error: "Ocurrió un error en el servidor durante el registro." });
  }
});

exports.api = onRequest({ timeoutSeconds: 300, memory: "1GiB" }, app);