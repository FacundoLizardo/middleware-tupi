const express = require('express');
const dotenv = require('dotenv');
const app = express();
const port = 3000;

// Cargar las variables de entorno
dotenv.config();

// Middleware para filtrar la respuesta y realizar la búsqueda con el token
async function filterResponse(req, res) {
    try {
        // Crear el cuerpo de la solicitud como application/x-www-form-urlencoded
        const body = new URLSearchParams();
        body.append('user', process.env.USER);
        body.append('password', process.env.PASSWORD);

        // Realizar la autenticación para obtener el token
        const authResponse = await fetch('https://tupi.com.py/api-legacy/v1/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        const authData = await authResponse.json();

        if (!authData.token) {
            return res.status(401).json({ message: 'No se pudo obtener el token de autenticación' });
        }

        const token = authData.token;

        // Obtener la query obligatoria y los otros parámetros opcionales de la URL
        const { query, pagina, precio } = req.query;

        // Verificar que 'query' exista, ya que es obligatorio
        if (!query) {
            return res.status(400).json({ message: 'El parámetro "query" es obligatorio.' });
        }

        // Construir la URL base con la query
        let searchUrl = `https://tupi.com.py/api-legacy/v1/buscar?query=${query}`;

        // Agregar 'pagina' si está presente
        if (pagina) {
            searchUrl += `&pagina=${pagina}`;
        }

        // Agregar 'precio' si está presente
        if (precio) {
            searchUrl += `&precio=${precio}`;
        }

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

        // Incluir busqueda_id en la respuesta
        const response = {
            busqueda_id: data.busqueda_id,
            resultados: filteredData
        };

        // Enviar la respuesta filtrada
        return res.json(response);

    } catch (error) {
        console.error(error);
        // Asegúrate de manejar cualquier error y enviar solo una respuesta
        return res.status(500).json({ message: 'Error al realizar la autenticación o la búsqueda' });
    }
}

// Middleware para parsear JSON
app.use(express.json());

// Endpoint que recibe los parámetros por query
app.get('/api/search', filterResponse);

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
