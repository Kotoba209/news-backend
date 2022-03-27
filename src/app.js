const express = require('express')
const cookieSession = require('cookie-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')

const { csrfProtect } = require('./utils')
const { session_key } = require('./utils/keys')
const { router } = require('./router')

const app = express()

app.use(cors()) // 解决跨域问题
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cookieSession({
  name: 'my_session',
  keys: [session_key],
  maxAge: 1000 * 60 * 60 *24
}))
app.use(csrfProtect, router)


app.listen(3001, () => {
  console.log('app is running at port 3001')
})
