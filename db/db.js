const mysql = require('mysql')

const orm_config = {
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: 'root',
  database: 'news'
}

let options = {}
let tableSQL = ''
let isConnect = false

function Model(name, options) {
  this.name = name
  this.options = options
}

Model.prototype.find = function (options, callback) {
  if (!isConnect) {
    this.connect(err => {
      isConnect = true
      var str = ''
      if (!callback) {
        str = `select * from ${this.name}`
        callback = options
      } else if (options.constructor === Array) {
        str = `select ${options.join()} from ${this.name}`
      } else if (options.constructor === Object) {
        str = `select ${options.arr.join()} from ${this.name} where ${options.where}`
      } else {
        str = `select * from ${this.name} where ${options}`
      }
      connection.query(str, (error, results, fields) => {
        callback(error, results, fields);
      });
      return this;
    })
  } else {
    var str = ''
    if (!callback) {
      str = `select * from ${this.name}`
      callback = options
    } else if (options.constructor === Array) {
      str = `select ${options.join()} from ${this.name}`
    } else {
      str = `select * from ${this.name} where ${options}`
    }
    connection.query(str, (error, results, fields) => {
      callback(error, results, fields)
    })
    return this
  }
}

Model.prototype.connect = function (callback) {
  let p1 = new Promise((resolve, reject) => {
    connection.connect(err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
  p1.then(() => {
    callback(null)
  })
  .catch(err => {
    if (err.sqlState == 42000) {
      createDarabase(callback)
    } else if (err.sqlState == 28000) {
      callback('数据库账号或密码错误')
    } else {
      callback(err)
    }
  })
}

Model.prototype.limit = function (options, callback) {
  let str = ''
  if (!options.where) {
    str = `select * from ${this.name} limit ${(options.number - 1) * options.count}, ${options.count}`
  } else {
    str = `select * from ${this.name} where ${options.where} limit ${(options.number - 1) * options.count}, ${options.count}`
  }
  connection.query(str, (err, results, fields) => {
    callback(err, results, fields)
  })
  return this
}

Model.prototype.insert = function(obj, callback) {
  if (!isConnect) {
    this.connect(err => {
      if (err) {
        console.log(err, 'err')
      } else {
           connection.query(tableSQL, () => {
             if (Array.isArray(obj)) {
               for(let i = 0; i < obj.length; i++) {
                 this.insertObj(obj[i], callback)
               }
             } else {
               this.insertObj(obj, callback)
             }
           })
         }
    })
  } else {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i ++) {
        this.insertObj(obj[i], callback)
      }
    } else {
      this.insertObj(obj, callback)
    }
  }
}

Model.prototype.insertObj = function (obj, callback) {
  let keys = []
  let values = ''
  for (let key in obj) {
    keys.push(key)
    values += `"${obj[key]}",`
  }
  values = values.replace(/,$/, '')
  let str = `INSERT INTO ${this.name} (${keys.join()}) VALUES (${values})`
  connection.query(str, (error, results, fields) => {
    callback(error, results, fields)
  })
}

Model.prototype.update = function (options, obj, callback) {
  let str = ''
  if (arguments.length === 2) {
    callback = obj
    obj = options
    str = `UPDATE ${this.name} SET `
    for (let key in obj) {
      str += `${key} = ${obj[key]}`
    }
    str = str.replace(/(,)$/, '')
    console.log('str', str)
  } else {
    str = `UPDATE ${this.name} SET `
    for (let key in obj) {
      str += `${key} = '${obj[key]}',`
    }
    str = str.replace(/(,)$/, '')
    str += ` where ${options}`;
  }
  console.log('str233', str)
  connection.query(str, (error, results, fields) => {
    callback(error, results, fields)
  })
  return this
}

Model.prototype.delete = function (options, callback) {
  let str = ''
  if (!callback) {
    str = `delete from ${this.name}`
    callback = options
  } else {
    str = `delete from ${this.name} where ${options}`
  }
  connection.query(str, (error, results, fields) => {
    callback(error, results, fields)
  })
  return this
}

Model.prototype.sql = function (str, callback) {
  connection.query(str, (error, results, fields) => {
    callback(error, results, fields)
  })
  return this
}

let createDarabase = function (callback) {
  let p2 = new Promise((resolve, reject) => {
    connection = mysql.createConnection({
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password
    })
    connection.connect((err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
  let p3 = new Promise((resolve, reject) => {
    connection.query(`CREATE DATABASE ${options.database}`, (err, results, fields) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
  let p4 = new Promise((resolve, reject) => {
    connection.query(`use ${options.database}`, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })

  let pAll = Promise.all([p2, p3, p4])

  pAll.then(() => {
    callback(null)
  })
  .catch(err => {
    callback(err)
  })
}

let orm = {
  connect: function ({ host, port, user, password, database }) {
    databaseName = database
    options = {
      host,
      port,
      user,
      password,
      database
    }
    connection = mysql.createConnection(options)
  },
  model: function (name, options) {
    let str = 'id int primary keu auto_increment'
    for (let key in options) {
      if (options[key] === Number) {
        str += `${key} numeric`
      } else if (options[key] === Date) {
        str += `${key} timestamp`
      } else {
        str += `${key} varchar(255)`
      }
    }
    str = str.replace(/,$/, '')
    tableSQL = `CREATE TABLE ${name} (${str})`
    return new Model(name, options)
  }
}

orm.connect(orm_config)

module.exports = orm
