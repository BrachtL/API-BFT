const mysql = require('mysql2/promise');

// Create a MySQL database connection pool
const pool = mysql.createPool({
  host: 'sql10.freemysqlhosting.net',
  user: 'sql10611177',
  password: 'CCArxAhbqc',
  database: 'sql10611177',
  connectionLimit: 10,
  idleTimeout: 270000 // set the idle timeout to 3 minutes
});

async function getCurrentDbTime() {
  try {
    const connection = await pool.getConnection();

    const [rows, fields] = await connection.query('SELECT TIME(NOW()) AS timeNOW');
    
    connection.release();
    
    const currentDbTime = rows[0].timeNOW;
    console.log(`///// Current DB time is:`, currentDbTime, `/////`);
    return currentDbTime;
  }
  catch(error) {
    console.log("Error getting database time:", error);
  }
}



//var currentDbTime = getCurrentDbTime();
//is it always 2m50s?

module.exports = async function sectionRenewer() {
  await getCurrentDbTime();
  setInterval(async () => { 
    console.log("keep server alive:");
    await getCurrentDbTime();
  }, 240000);
}
