const db = require('../../db/db')

async function handleDB (res, tableName, methodName, errMsg, n1 = '', n2 = '') {
  console.log('tableName', tableName)
  let model = db.model(tableName)
  let results
  try {
    results = await new Promise((resolve ,reject) => {
      if (!n1) {
        model[methodName]((err, data) => {
          if (err) { reject(err); throw err }
          resolve(data)
        })
        return
      }
      if (!n2) {
        model[methodName](n1, (err, data) => {
          if (err) { reject(err); throw err }
          resolve(data)
        })
        return
      }
      model[methodName](n1, n2, (err, data) => {
        if (err) { reject(err); throw err }
        resolve(data)
      })
    })
  } catch (error) {
    console.log('error', error)
    res.send('数据库操作出错')
    throw error
  }
  return results
}

function getRandomString (n) {
  var str='';
  while (str.length < n) {
    str += Math.random().toString(36).substr(2);
  }
  return str.substr(str.length-n)
}

function csrfProtect (req, res, next){
  const method = req.method
  if (method === 'GET') {
    const csrf_token = getRandomString(48);
    res.cookie('csrf_token', csrf_token);
    next() //执行跳转到下一个函数执行，即app.use(beforeReq,router)中的下一个
  } else if (method === 'POST') {
    // 前端传的cookie || 或者是请求里携带的cookie
    const cookie = req.headers['x-csrftoken'] || req.cookies['csrf_token']
    if (cookie === req.cookies['csrf_token']) {
      console.log('csrf验证通过！');
      next()
    } else {
      res.json({
        code: '4',
        msg: 'csrf验证失败'
      })
    }
  }
}

async function getUserInfo (req, res) {
  const userId = req.session['user_id']
  console.log('userId-login', userId)
  const result = await handleDB(res, 'info_user', 'find', '查询用户报错', `id = ${userId}`)
  return result[0]
}

module.exports = {
  handleDB,
  getRandomString,
  csrfProtect,
  getUserInfo
}
