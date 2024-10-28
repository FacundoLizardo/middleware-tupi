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

        // Obtener los parámetros de la URL
        const { query, pagina, precio, id } = req.query;

        // Si el parámetro 'id' está presente, hacer una solicitud específica de producto
        if (id) {
            const productUrl = `https://tupi.com.py/api-legacy/v1/producto?id=${id}`;
            const productResponse = await fetch(productUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'User-Agent': 'Neural Genius'
                }
            });

            let productData = await productResponse.json();

            // Remover propiedades innecesarias del producto y filtrar precios sin 'cod_feria'
            const { es_disponible, es_combo, vigencia_desde, vencimiento, composicion, feria, peso, largo, alto, ancho, rubro, familia, linea, ...filteredProductData } = productData;

            if (filteredProductData.precios) {
                filteredProductData.precios = filteredProductData.precios.map(({ cod_feria, mostrar, ...rest }) => {
                    console.log(cod_feria);
                    
                    return rest});
            }

            // Enviar la respuesta del producto sin las propiedades excluidas
            return res.json(filteredProductData);
        }

        // Verificar que 'query' exista, ya que es obligatorio si 'id' no está presente
        if (!query) {
            return res.status(400).json({ message: 'El parámetro "query" es obligatorio.' });
        }

        // Construir la URL base para la búsqueda general
        let searchUrl = `https://tupi.com.py/api-legacy/v1/buscar?query=${query}`;

        // Agregar 'pagina' si está presente
        if (pagina) {
            searchUrl += `&pagina=${pagina}`;
        }

        // Agregar 'precio' si está presente
        if (precio) {
            searchUrl += `&precio=${precio}`;
        }

        // Realizar la búsqueda general con el token de autenticación
        const dataResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'User-Agent': 'Neural Genius'
            }
        });

        const data = await dataResponse.json();

        // Filtrar la respuesta general para devolver solo los campos solicitados y eliminar 'cod_feria' en precios
        const filteredData = data.data.map(item => ({
            id: item.id,
            producto: item.producto,
            precios: item.precios.filter(precio => precio.mostrar === true).map(({ cod_feria, ...rest }) => rest),
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
