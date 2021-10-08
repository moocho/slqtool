const dbConfig = (mode) => {
  
  let config = {
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    options: {
      enableArithAbort: true,
      encrypt: true
    },
    requestTimeout: 600000
  }
  
  if(mode && mode === 'admin'){
    config.user = process.env.DB_USERNAME
    config.password = process.env.DB_PASSWORD
  }else {
    config.user = process.env.DB_USERNAME_READ
    config.password = process.env.DB_PASSWORD_READ
  }
  return config
}


module.exports = {
  db: dbConfig
}
