document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "https://api-emkc4yg6zq-uc.a.run.app";
    const auth = firebase.auth();

    const recommendForm = document.getElementById('recommend-form');
    if (recommendForm) {
        const userTastesInput = document.getElementById('user-tastes');
        const timeFilter = document.getElementById('time-filter');
        const statusFilter = document.getElementById('status-filter');
        const loader = document.getElementById('loader');
        const resultsContainer = document.getElementById('results-container');

        recommendForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            loader.classList.remove('hidden');
            resultsContainer.innerHTML = '';

            const user = auth.currentUser;
            if (!user) {
                alert("Error de sesión. Por favor, refresca la página.");
                loader.classList.add('hidden');
                return;
            }

            try {
                const idToken = await user.getIdToken(true);

                const payload = {
                    tastes: userTastesInput.value,
                    time: timeFilter.value,
                    status: statusFilter.value,
                };

                const response = await fetch(`${API_URL}/recommendations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error en la respuesta del servidor.');
                }

                const mangas = await response.json();
                displayResults(mangas);

            } catch (error) {
                console.error("Falló la petición de recomendación:", error);
                resultsContainer.innerHTML = `<p style="color: red; text-align: center;">Oops. ${error.message}</p>`;
            } finally {
                loader.classList.add('hidden');
            }
        });

        function displayResults(mangas) {
            resultsContainer.innerHTML = '';
            if (mangas.length === 0) {
                resultsContainer.innerHTML = `<p style="text-align: center;">No encontramos una recomendación con esos criterios. ¡Intenta ser más descriptivo!</p>`;
                return;
            }
            mangas.forEach(manga => {
                const card = document.createElement('div');
                card.className = 'manga-card';
                const synopsis = manga.synopsis ? manga.synopsis.substring(0, 200) + '...' : 'Sin sinopsis.';
                card.innerHTML = `
                    <img src="${manga.main_picture.large}" alt="Portada de ${manga.title}">
                    <div>
                        <h3>${manga.title}</h3>
                        <p><strong>Capítulos:</strong> ${manga.num_chapters || 'N/A'}</p>
                        <p><strong>Estado:</strong> ${manga.status === 'finished' ? 'Terminado' : 'En emisión'}</p>
                        <p>${synopsis}</p>
                    </div>
                `;
                resultsContainer.appendChild(card);
            });
        }
    }
});