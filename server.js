const express = require('express');
const bodyParser = require('body-parser');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, getDoc, query, where } = require('firebase/firestore');
const path = require('path');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');
const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});


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
server.use(express.json());
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


// Ruta para el login
server.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const userRef = doc(db, 'usuarios', userRecord.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return res.status(404).send('Usuario no encontrado');
    }

    const userData = userSnap.data();

    if (userData.tipo === 'admin') {
      // Si el tipo es admin, renderiza la vista 'menu.ejs'
      res.render('menu');
    } else {
      res.status(401).send('Acceso denegado: No eres un administrador');
    }
  } catch (error) {
    console.error('Error al autenticar el usuario:', error);
    res.status(404).send('Error: ' + error.message);
  }
});



// Ruta para el menú de administrador
server.get('/menu', (req, res) => {
  res.render('menu'); // Asegúrate de tener un archivo 'menu.ejs' para el menú de administrador
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

server.post('/register-user', async (req, res) => {
  const { nombre, userType, email, password } = req.body;

  try {
    // Aquí debes usar Firebase Admin SDK para manejar la autenticación en el backend
    const admin = require('firebase-admin');
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    const userId = userRecord.uid;

    // Guardar datos adicionales en Firestore
    await setDoc(doc(db, "usuarios", userId), {
      nombre: nombre,
      tipo: userType,
      correo: email,
      creadoEn: new Date().toISOString(),
    });

    res.status(200).json({ message: 'Usuario registrado con éxito' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Hubo un error al registrar el usuario' });
  }
});


server.get('/get-users', async (req, res) => {
  try {
    const usuariosRef = collection(db, "usuarios");
    const querySnapshot = await getDocs(usuariosRef);
    const usuarios = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Hubo un error al obtener los usuarios' });
  }
});

server.get('/edit-user/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    // Obtener el usuario de Firestore
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Renderizar la vista edit_us.ejs con los datos del usuario
      res.render('edit_us', { id: userId, user: userSnap.data() });
    } else {
      res.status(404).send('Usuario no encontrado');
    }
  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    res.status(500).send('Hubo un error al obtener el usuario');
  }
});

server.post('/update-user/:id', async (req, res) => {
  const userId = req.params.id;
  const { nombre, tipo, correo, password } = req.body;

  try {
      // Actualizar datos en Firestore
      const userRef = doc(db, "usuarios", userId);
      await setDoc(userRef, { nombre, tipo, correo }, { merge: true });

      // Actualizar datos en Firebase Authentication
      await admin.auth().updateUser(userId, {
          email: correo,
          password: password,
      });

      res.redirect('/index_us'); // Redirigir a la lista de usuarios
  } catch (error) {
      console.error('Error al actualizar usuario:', error);
      res.status(500).send('Hubo un error al actualizar el usuario');
  }
});

server.delete('/delete-user/:id', async (req, res) => {
  const userId = req.params.id;

  try {
      await admin.auth().deleteUser(userId); // Eliminar de Firebase Authentication
      const userRef = doc(db, "usuarios", userId);
      await deleteDoc(userRef); // Eliminar de Firestore
      res.status(200).send('Usuario eliminado con éxito');
  } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).send('Error al eliminar usuario');
  }
});

server.post('/confirm-cancel', async (req, res) => {
  const { id, tipo, productos } = req.body; // Recibe el ID, tipo y productos

  try {
      // Actualiza el estado en Firestore (pedidos o envíos)
      const collectionName = tipo === "pedido" ? "pedidos" : "envios";
      const docRef = doc(db, collectionName, id);
      await setDoc(docRef, { estado: "cancelación confirmada" }, { merge: true });

      // Actualiza el inventario en la colección 'catalogo'
      for (const producto of productos) {
          const catalogoRef = doc(db, "catalogo", producto.nombre);
          const catalogoSnap = await getDoc(catalogoRef);

          if (catalogoSnap.exists()) {
              const currentStock = catalogoSnap.data().Stock || 0;
              const updatedStock = currentStock + producto.cantidad;
              await setDoc(catalogoRef, { Stock: updatedStock }, { merge: true });
          }
      }

      res.status(200).json({ message: "Cancelación confirmada y stock actualizado." });
  } catch (error) {
      console.error("Error al confirmar cancelación:", error);
      res.status(500).json({ error: "Error al confirmar cancelación." });
  }
});

server.post('/upload-file', upload.single('archivo'), async (req, res) => {
  const { id, tipo, cliente, fecha } = req.body;

  try {
    // Generar nombre de archivo
    const fileName = `${id}_${cliente}_${tipo}_${fecha}.jpg`;

    // Subir archivo a Google Drive
    const folderId = '1B4WU662cLDdAhg988zibY_9bRYYWDmuP'; // Cambia por el ID de tu carpeta en Google Drive
    const driveFileId = await uploadFileToDrive(req.file.path, fileName, folderId);

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: 'Imagen subida con éxito',
      imageUrl: `https://drive.google.com/uc?id=${driveFileId}`,
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

server.post('/confirm-close', upload.single('image'), async (req, res) => {
  const { id, tipo, cliente, tipoEntrega, fecha } = req.body;
  const file = req.file; // Imagen subida
  const folderId = '1B4WU662cLDdAhg988zibY_9bRYYWDmuP'; // Cambia por tu folderId real

  try {
    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen.' });
    }

    // Formatear el nombre del archivo
    const fileName = `${id},${cliente},${tipoEntrega},${fecha}.jpg`;

    // Subir la imagen a Google Drive
    const driveFileId = await uploadFileToDrive(file.path, fileName, folderId);

    // Eliminar el archivo temporal
    fs.unlinkSync(file.path);

    // Actualizar el estado del pedido/envío en Firestore
    const collectionName = tipo === 'pedido' ? 'pedidos' : 'envios';
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, { estado: 'cerrado confirmado' }, { merge: true });

    res.status(200).json({ message: 'Cierre confirmado y archivo subido con éxito.' });
  } catch (error) {
    console.error('Error al confirmar cierre:', error);
    res.status(500).json({ error: 'Error al confirmar cierre.' });
  }
});



// Inicia el servidor en el puerto 3000
server.listen(3000, () => {
  console.log("Servidor escuchando en puerto 3000");
});
