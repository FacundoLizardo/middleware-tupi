const express = require('express');
const dotenv = require('dotenv');
const app = express();
const port = 3000;

// Cargar las variables de entorno
dotenv.config();

// Middleware para filtrar la respuesta y realizar la búsqueda con el token
async function filterResponse(req, res, next) {
    try {
        // Realizar la autenticación para obtener el token
        const authResponse = await fetch('https://tupi.com.py/api-legacy/v1/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user: process.env.USER,
                password: process.env.PASSWORD
            })
        });

        const authData = await authResponse.json();

        if (authData.token) {
            const token = authData.token;

            // Obtener parámetros del body
            const { pagina, query, precio } = req.body;

            // Construir la URL con parámetros de búsqueda (sin 'disponible')
            const searchUrl = `https://tupi.com.py/api-legacy/v1/buscar?pagina=${pagina}&query=${query}&precio=${precio}`;

            // Realizar la búsqueda con el token de autenticación
            const dataResponse = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'User-Agent': 'Thunder Client (https://www.thunderclient.com)'
                }
            });

            const data = await dataResponse.json();

            // Filtrar la respuesta para devolver solo los campos solicitados
            const filteredData = data.data.map(item => ({
                id: item.id,
                producto: item.producto,
                precios: item.precios.filter(precio => precio.mostrar === true), // Filtrar precios con 'mostrar: true'
                img: item.img,
                link: item.link
            }));

            // Enviar la respuesta filtrada
            res.json(filteredData);
        } else {
            res.status(401).json({ message: 'No se pudo obtener el token de autenticación' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al realizar la autenticación o la búsqueda' });
    }

    next();
}

// Middleware para parsear JSON
app.use(express.json());

// Endpoint que recibe los parámetros por body
app.post('/api/search', filterResponse, (req, res) => {
    // La respuesta ya será procesada y devuelta en el middleware
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
