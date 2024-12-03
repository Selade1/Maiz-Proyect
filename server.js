const express = require('express');
const bodyParser = require('body-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, getDoc, query, where } = require('firebase/firestore');
const path = require('path');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDir1EGmb6BKQHqLMTjtEb3QWCDLaaXK_0",
  authDomain: "maiz-db.firebaseapp.com",
  projectId: "maiz-db",
  storageBucket: "maiz-db.appspot.com",
  messagingSenderId: "585244696486",
  appId: "1:585244696486:web:efc2e9c4cbc75c3fd9b967",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Configuración del servidor Express
const server = express();
server.use(bodyParser.urlencoded({ extended: true }));
server.use(express.static('public')); // Sirve archivos estáticos (como menu.html) desde la carpeta 'public'

// Configura EJS como motor de plantillas
server.set('views', path.join(__dirname, 'views')); // Directorio de vistas
server.set('view engine', 'ejs'); // Usar EJS como motor de plantillas

// Configuración de Google Drive
const credentials = require('./google-drive-credentials.json');
const auth = new google.auth.GoogleAuth({
  keyFile: './google-drive-credentials.json', // Ruta al archivo JSON
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

(async () => {
  try {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list(); // Intenta listar archivos
    console.log('Google Drive API Conectada:', res.data);
  } catch (error) {
    console.error('Error con las credenciales:', error);
  }
})();
const drive = google.drive({ version: 'v3', auth });

// Función para subir un archivo a Google Drive
async function uploadFileToDrive(filePath, fileName, folderId) {
  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };
  const media = {
    mimeType: 'image/jpeg',
    body: fs.createReadStream(filePath),
  };
  const response = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id',
  });
  return response.data.id;
}

// Middleware para manejo de archivos
const upload = multer({ dest: 'uploads/' }); // Carpeta temporal para archivos

// Ruta para servir el archivo index.html desde la carpeta 'views'
server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html')); // Muestra 'index.html' al acceder a la raíz
});

// Ruta para listar productos
server.get('/index_inv', async (req, res) => {
  try {
    const catalogoRef = collection(db, "catalogo");
    const querySnapshot = await getDocs(catalogoRef);
    const products = [];
    querySnapshot.forEach((doc) => {
      products.push(doc.data());
    });
    res.render('index_inv', { products }); // Renderiza la vista con los productos
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).send("Error al obtener productos");
  }
});

// Ruta para agregar un nuevo producto con imagen
server.post('/add-product', upload.single('image'), async (req, res) => {
  const { ID, Nombre_producto, Precio, Stock } = req.body;

  if (!ID) {
    console.error('El campo ID está vacío o no fue enviado.');
    return res.status(400).send('Error: El ID del producto es requerido.');
  }

  const file = req.file;

  const newProductData = {
    ID: parseInt(ID),
    Nombre_producto,
    Precio: parseFloat(Precio),
    Stock: parseInt(Stock),
  };

  try {
    if (file) {
      const folderId = '1fXrdic21Cyk-g-tyD29nPEGxznR9eGM1'; // Tu folder ID en Google Drive
      const driveFileId = await uploadFileToDrive(file.path, file.originalname, folderId);
      newProductData.imageUrl = `https://drive.google.com/uc?id=${driveFileId}`;
    }

    const catalogoRef = collection(db, "catalogo");
    await setDoc(doc(catalogoRef, ID.toString()), newProductData);

    if (file) fs.unlinkSync(file.path); // Elimina el archivo temporal

    res.redirect('/index_inv');
  } catch (error) {
    console.error('Error al agregar el producto:', error);
    res.status(500).send('Error al agregar el producto');
  }
});


// Ruta para editar un producto
server.get('/edit-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const docRef = doc(db, "catalogo", productId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      res.render('edit_product', { product: docSnap.data() }); // Renderiza el formulario de edición con los datos del producto
    } else {
      res.status(404).send('Producto no encontrado');
    }
  } catch (error) {
    console.error("Error obteniendo el producto:", error);
    res.status(500).send("Hubo un error al obtener el producto");
  }
});

// Ruta para procesar la modificación de un producto
server.post('/update-product/:id', async (req, res) => {
  const productId = req.params.id;
  const { ID, Nombre_producto, Precio, Stock } = req.body;

  const updatedProductData = {
    ID: parseInt(ID),
    Nombre_producto,
    Precio: parseFloat(Precio),
    Stock: parseInt(Stock)
  };

  try {
    const docRef = doc(db, "catalogo", productId);
    await setDoc(docRef, updatedProductData); // Actualiza el producto en Firestore

    res.redirect('/index_inv'); // Redirige a la lista de productos
  } catch (error) {
    console.error("Error actualizando el producto:", error);
    res.status(500).send("Hubo un error al actualizar el producto");
  }
});

// Ruta para eliminar un producto
server.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const docRef = doc(db, "catalogo", productId);
    await deleteDoc(docRef); // Elimina el producto de Firestore

    res.redirect('/index_inv'); // Redirige a la lista de productos
  } catch (error) {
    console.error("Error eliminando el producto:", error);
    res.status(500).send("Hubo un error al eliminar el producto");
  }
});

// Rutas para la gestión de vehículos
server.get('/vehiculos', async (req, res) => {
  try {
    const vehiclesRef = collection(db, "vehiculo");
    const querySnapshot = await getDocs(vehiclesRef);
    const vehicles = [];
    
    querySnapshot.forEach((doc) => {
      vehicles.push(doc.data()); // Agrega cada vehículo a la lista
    });

    res.render('index_vhc', { vehicles: vehicles }); // Renderiza la vista de gestión de vehículos
  } catch (error) {
    console.error("Error obteniendo los vehículos:", error);
    res.status(500).send("Hubo un error al obtener los vehículos");
  }
});

// Ruta para agregar un nuevo vehículo
server.post('/add-car', async (req, res) => {
  const { ID, modelo, numeroDeSerie } = req.body;

  const newCarData = {
    ID,
    modelo,
    numeroDeSerie
  };

  try {
    const docRef = doc(db, "vehiculo", ID);
    await setDoc(docRef, newCarData); // Guarda el vehículo en Firestore

    res.redirect('/vehiculos'); // Redirige a la página de vehículos
  } catch (error) {
    console.error("Error al agregar el vehículo:", error);
    res.status(500).send("Hubo un error al agregar el vehículo");
  }
});

// Ruta para modificar un vehículo
server.get('/edit-vehicle/:id', async (req, res) => {
  const vehicleId = req.params.id;
  
  try {
    const docRef = doc(db, "vehiculo", vehicleId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      res.render('edit_vehicle', { vehicle: docSnap.data() }); // Renderiza el formulario de edición con los datos del vehículo
    } else {
      res.status(404).send('Vehículo no encontrado');
    }
  } catch (error) {
    console.error("Error obteniendo el vehículo:", error);
    res.status(500).send("Hubo un error al obtener el vehículo");
  }
});

// Ruta para procesar la modificación de un vehículo
server.post('/update-vehicle/:id', async (req, res) => {
  const vehicleId = req.params.id;
  const { ID, modelo, numeroDeSerie } = req.body;

  const updatedVehicleData = {
    ID,
    modelo,
    numeroDeSerie
  };

  try {
    const docRef = doc(db, "vehiculo", vehicleId);
    await setDoc(docRef, updatedVehicleData); // Actualiza el vehículo en Firestore

    res.redirect('/vehiculos'); // Redirige a la lista de vehículos
  } catch (error) {
    console.error("Error actualizando el vehículo:", error);
    res.status(500).send("Hubo un error al actualizar el vehículo");
  }
});

// Ruta para eliminar un vehículo
server.post('/delete-vehicle/:id', async (req, res) => {
  const vehicleId = req.params.id;

  try {
    const docRef = doc(db, "vehiculo", vehicleId);
    await deleteDoc(docRef); // Elimina el vehículo de Firestore

    res.redirect('/vehiculos'); // Redirige a la lista de vehículos
  } catch (error) {
    console.error("Error eliminando el vehículo:", error);
    res.status(500).send("Hubo un error al eliminar el vehículo");
  }
});

// Ruta para la gestión de pedidos y envíos con filtros
server.get('/index_ped', async (req, res) => {
  const { tipoPedido, cliente, vehiculo, fecha } = req.query;

  let pedidosRef = collection(db, "pedidos");
  let enviosRef = collection(db, "envios");

  // Inicializamos las consultas
  let pedidosQuery = pedidosRef;
  let enviosQuery = enviosRef;

  // Filtro por tipo de pedido (tipoEntrega)
  if (tipoPedido) {
    if (tipoPedido === "Envio") {
      enviosQuery = query(enviosQuery, where("tipoEntrega", "==", "Flete"));
      pedidosQuery = null; // No mostrar pedidos si es "Envio"
    } else if (tipoPedido === "Pedido") {
      pedidosQuery = query(pedidosQuery, where("tipoEntrega", "not-in", ["Flete"]));
      enviosQuery = null; // No mostrar envíos si es "Pedido"
    }
  }

  // Filtro por cliente
  if (cliente) {
    if (pedidosQuery) {
      pedidosQuery = query(pedidosQuery, where("nombreCliente", "==", cliente));
    }
    if (enviosQuery) {
      enviosQuery = query(enviosQuery, where("nombreCliente", "==", cliente));
    }
  }

  // Filtro por vehículo (solo se aplica a envíos)
  if (vehiculo) {
    enviosQuery = query(enviosQuery, where("idCamion", "==", vehiculo));
    pedidosQuery = null; // No mostrar pedidos cuando se filtra por vehículo
  }

  // Filtro por fecha
  if (fecha) {
    // Aquí, la fecha ya está en formato 'yyyy-mm-dd' desde el frontend
    const fechaFormatoCorrecto = fecha; // La fecha ya es correcta, no es necesario convertirla

    if (pedidosQuery) {
      pedidosQuery = query(pedidosQuery, where("fecha", "==", fechaFormatoCorrecto));
    }
    if (enviosQuery) {
      enviosQuery = query(enviosQuery, where("fecha", "==", fechaFormatoCorrecto));
    }
  }

  try {
    const pedidos = [];
    const envios = [];

    if (pedidosQuery) {
      const pedidosSnapshot = await getDocs(pedidosQuery);
      pedidosSnapshot.forEach((doc) => {
        pedidos.push(doc.data()); // Agrega cada pedido a la lista
      });
    }

    if (enviosQuery) {
      const enviosSnapshot = await getDocs(enviosQuery);
      enviosSnapshot.forEach((doc) => {
        envios.push(doc.data()); // Agrega cada envío a la lista
      });
    }

    // Obtener los clientes para el filtro
    const clientesRef = collection(db, "clientes");
    const clientesSnapshot = await getDocs(clientesRef);
    const clientes = [];
    clientesSnapshot.forEach((doc) => {
      clientes.push(doc.data().nombre); // Suponiendo que el nombre del cliente está en el campo 'nombre'
    });

    // Obtener los vehículos para el filtro
    const vehiculosRef = collection(db, "vehiculo");
    const vehiculosSnapshot = await getDocs(vehiculosRef);
    const vehiculos = [];
    vehiculosSnapshot.forEach((doc) => {
      vehiculos.push(doc.id); // Se asume que el ID del vehículo es el valor que se muestra en el filtro
    });

    // Renderizar la vista con los datos obtenidos
    res.render('index_ped', { 
      pedidos: pedidos, 
      envios: envios, 
      clientes: clientes, 
      vehiculos: vehiculos 
    });

  } catch (error) {
    console.error("Error obteniendo los pedidos y envíos:", error);
    res.status(500).send("Error al obtener los pedidos y envíos");
  }
});


// Función para obtener los clientes desde Firestore
async function getClientes() {
  const clientesRef = collection(db, 'clientes');
  const snapshot = await getDocs(clientesRef);
  const clientes = [];
  snapshot.forEach((doc) => {
    clientes.push(doc.data().nombreCliente); // Asume que cada documento de cliente tiene un campo 'nombreCliente'
  });
  return clientes;
}

// Función para obtener los vehículos desde Firestore
async function getVehiculos() {
  const vehiculosRef = collection(db, 'vehiculo');
  const snapshot = await getDocs(vehiculosRef);
  const vehiculos = [];
  snapshot.forEach((doc) => {
    vehiculos.push(doc.data().ID); // Asume que cada documento de vehículo tiene un campo 'ID'
  });
  return vehiculos;
}

// Ruta para servir el archivo index_us.ejs
server.get('/index_us', async (req, res) => {
  try {
    // Aquí puedes realizar cualquier consulta o lógica que necesites
    res.render('index_us'); // Renderiza la vista 'index_us.ejs'
  } catch (error) {
    console.error("Error al obtener la vista:", error);
    res.status(500).send("Hubo un error al obtener la vista");
  }
});


// Inicia el servidor en el puerto 3000
server.listen(3000, () => {
  console.log("Servidor escuchando en puerto 3000");
});
