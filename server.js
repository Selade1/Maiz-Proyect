const express = require('express');
const bodyParser = require('body-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, getDoc, query, where } = require('firebase/firestore');
const path = require('path');

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

// Ruta para servir el archivo index.html desde la carpeta 'views'
server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html')); // Muestra 'index.html' al acceder a la raíz
});

// Rutas para la gestión de productos
server.get('/index_inv', async (req, res) => {
  try {
    const catalogoRef = collection(db, "catalogo");
    const querySnapshot = await getDocs(catalogoRef);
    const products = [];

    querySnapshot.forEach((doc) => {
      products.push(doc.data()); // Agrega cada producto a la lista
    });

    res.render('index_inv', { products: products }); // Renderiza la vista de gestión de productos
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    res.status(500).send("Error al obtener productos");
  }
});

// Ruta para agregar un nuevo producto
server.post('/add-product', async (req, res) => {
  const { ID, Nombre_producto, Precio, Stock } = req.body;

  const newProductData = {
    ID: parseInt(ID),               // ID de tipo INT
    Nombre_producto: Nombre_producto, // Nombre del producto
    Precio: parseFloat(Precio),      // Precio de tipo FLOAT
    Stock: parseInt(Stock)           // Stock de tipo INT
  };

  try {
    const catalogoRef = collection(db, "catalogo");
    await setDoc(doc(catalogoRef, ID.toString()), newProductData); // Usa el ID como documento

    res.redirect('/index_inv'); // Redirige a la página de gestión de productos
  } catch (error) {
    console.error("Error agregando producto:", error);
    res.status(500).send("Error al agregar el producto");
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
    pedidosQuery = query(pedidosQuery, where("tipoEntrega", "==", tipoPedido));
    enviosQuery = query(enviosQuery, where("tipoEntrega", "==", tipoPedido));
  }

  // Filtro por cliente
  if (cliente) {
    pedidosQuery = query(pedidosQuery, where("nombreCliente", "==", cliente));
    enviosQuery = query(enviosQuery, where("cliente", "==", cliente));
  }

  // Filtro por vehículo
  if (vehiculo) {
    pedidosQuery = query(pedidosQuery, where("vehiculo", "==", vehiculo));
    enviosQuery = query(enviosQuery, where("vehiculo", "==", vehiculo));
  }

  // Filtro por fecha
  if (fecha) {
    pedidosQuery = query(pedidosQuery, where("fecha", "==", fecha));
    enviosQuery = query(enviosQuery, where("fecha", "==", fecha));
  }

  try {
    const pedidosSnapshot = await getDocs(pedidosQuery);
    const enviosSnapshot = await getDocs(enviosQuery);

    const pedidos = [];
    pedidosSnapshot.forEach((doc) => {
      pedidos.push(doc.data()); // Agrega cada pedido a la lista
    });

    const envios = [];
    enviosSnapshot.forEach((doc) => {
      envios.push(doc.data()); // Agrega cada envío a la lista
    });

    // Combina los pedidos y envíos en un solo array para ser renderizado
    const allOrders = [...pedidos, ...envios];

    res.render('index_ped', { pedidos: allOrders, envios: envios }); // Pasa los datos de los pedidos y envíos a la vista
  } catch (error) {
    console.error("Error obteniendo los pedidos y envíos:", error);
    res.status(500).send("Error al obtener los pedidos y envíos");
  }
});




// Inicia el servidor en el puerto 3000
server.listen(3000, () => {
  console.log("Servidor escuchando en puerto 3000");
});
