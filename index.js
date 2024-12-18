const express = require("express");
const dotenv = require("dotenv");
const app = express();
const port = 3000;

// Cargar las variables de entorno
dotenv.config();

// Middleware para filtrar la respuesta y realizar la búsqueda con el token
async function filterResponse(req, res) {
  try {
    // Crear el cuerpo de la solicitud como application/x-www-form-urlencoded
    const body = new URLSearchParams();
    body.append("user", process.env.USER);
    body.append("password", process.env.PASSWORD);

    // Realizar la autenticación para obtener el token
    const authResponse = await fetch("https://tupi.com.py/api-legacy/v1/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const authData = await authResponse.json();

    if (!authData.token) {
      return res
        .status(401)
        .json({ message: "No se pudo obtener el token de autenticación" });
    }

    const token = authData.token;

    // Obtener los parámetros de la URL
    const { query, pagina, precio, id } = req.query;

    // Si el parámetro 'id' está presente, hacer una solicitud específica de producto
    if (id) {
      const productUrl = `https://tupi.com.py/api-legacy/v1/producto?id=${id}`;
      const productResponse = await fetch(productUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "*/*",
          "User-Agent": "Neural Genius",
        },
      });

      let productData = await productResponse.json();

      // Remover propiedades innecesarias del producto y filtrar precios sin 'cod_feria'
      const {
        es_disponible,
        es_combo,
        vigencia_desde,
        vencimiento,
        composicion,
        feria,
        peso,
        largo,
        alto,
        ancho,
        rubro,
        familia,
        linea,
        ...filteredProductData
      } = productData;

      if (filteredProductData.precios) {
        filteredProductData.precios = filteredProductData.precios.map(
          ({ cod_feria, mostrar, ...rest }) => {
            console.log(cod_feria);

            return rest;
          }
        );
      }

      // Enviar la respuesta del producto sin las propiedades excluidas
      return res.json(filteredProductData);
    }

    // Verificar que 'query' exista, ya que es obligatorio si 'id' no está presente
    if (!query) {
      return res
        .status(400)
        .json({ message: 'El parámetro "query" es obligatorio.' });
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
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "*/*",
        "User-Agent": "Neural Genius",
      },
    });

    const data = await dataResponse.json();

    // Filtrar la respuesta general para devolver solo los campos solicitados y eliminar 'cod_feria' en precios
    const filteredData = data.data.map((item) => ({
      id: item.id,
      producto: item.producto,
      precios: item.precios
        .filter((precio) => precio.mostrar === true)
        .map(({ cod_feria, ...rest }) => rest),
      img: item.img,
      link: item.link,
    }));

    // Incluir busqueda_id en la respuesta
    const response = {
      busqueda_id: data.busqueda_id,
      resultados: filteredData,
    };

    // Enviar la respuesta filtrada
    return res.json(response);
  } catch (error) {
    console.error(error);
    // Asegúrate de manejar cualquier error y enviar solo una respuesta
    return res
      .status(500)
      .json({ message: "Error al realizar la autenticación o la búsqueda" });
  }
}

async function getConversationId(req, res) {
  const { messages } = req.body;
  const api_key = process.env.API_KEY;
  const thinkchatToken = process.env.THINKCHAT_TOKEN;
  console.log({ messages });

  try {
    // Paso 1 y 2: Obtener las conversaciones y contar coincidencias (código existente)
    const options = {
      method: "GET",
      headers: { Authorization: `Bearer ${api_key}` },
    };

    const response = await fetch(
      "https://app.chaindesk.ai/api/conversations?channel=api&agentId=cm2xec08908cc4s7x96a94oti&take=10",
      options
    );
    const conversations = await response.json();

    const comparisonResults = await Promise.all(
      conversations.map(async (conversation) => {
        const conversationMessagesResponse = await fetch(
          `https://app.chaindesk.ai/api/conversations/${conversation.id}/messages`,
          options
        );
        const conversationMessages = await conversationMessagesResponse.json();

        const conversationAgents = conversationMessages.filter(
          (msg) => msg.from === "agent"
        );
        const conversationHumans = conversationMessages.filter(
          (msg) => msg.from === "human"
        );

        const bodyAgents = messages.filter((msg) => msg.agent);
        const bodyHumans = messages.filter((msg) => msg.human);

        const agentMatches = bodyAgents.reduce((count, bodyMsg, index) => {
          const convMsg = conversationAgents[index];
          if (convMsg && convMsg.text === bodyMsg.agent) {
            return count + 1;
          }
          return count;
        }, 0);

        const humanMatches = bodyHumans.reduce((count, bodyMsg, index) => {
          const convMsg = conversationHumans[index];
          if (convMsg && convMsg.text === bodyMsg.human) {
            return count + 1;
          }
          return count;
        }, 0);

        const totalMatches = agentMatches + humanMatches;
        const isFullMatch = totalMatches === messages.length;

        return {
          conversationId: conversation.id,
          totalMatches,
          isFullMatch,
        };
      })
    );

    const bestMatch = comparisonResults.reduce(
      (max, result) => (result.totalMatches > max.totalMatches ? result : max),
      { totalMatches: 0 }
    );

    const matchingConversations = comparisonResults.filter(
      (result) => result.isFullMatch
    );

    const selectedConversation =
      matchingConversations.length > 0
        ? matchingConversations[0].conversationId
        : bestMatch.conversationId;

    console.log({ selectedConversation });

    // Paso 6: Enviar la conversación al nuevo endpoint
    const postResponse = await fetch(
      "https://tupi.whatsapp.net.py/thinkcomm-x/integrations/bot/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "chat_to_queue",
          token: thinkchatToken,
          source: "595974321000",
          id_conversation: selectedConversation,
        }),
      }
    );

    console.log({postResponse});

    const postResult = await postResponse.json();
    res.json({
      bestMatch:
        matchingConversations.length > 0 ? matchingConversations : bestMatch,
      postResult,
    });
  } catch (error) {
    console.error("Error al obtener las conversaciones:", error);
    res.status(500).json({ error: "Error al obtener las conversaciones" });
  }
}

app.use(express.json());

// Endpoint que recibe los parámetros por query
app.get("/api/search", filterResponse);

// Endpoint para obtener el ID de la conversación en base a mensajes
app.post("/api/getConversationId", getConversationId);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
