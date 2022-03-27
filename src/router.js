const { Router } = require('express')
const md5 = require('md5')
const jwt = require('jsonwebtoken')
const multer = require('multer');
// const path = require('path')

const { handleDB, getUserInfo } = require('./utils')
const Captcha = require('./utils/captcha')
const { password_key } = require('./utils/keys')
const uploadFile = require('./utils/qn')

const upload = multer({ dest: 'public/images' })
const router = Router()

router.get('/possport/image/:float', (req, res) => {
  const captchaObj = new Captcha()
  const captcha = captchaObj.getCode()
  // captcha.text // 验证码文本
  // captcha.data // 验证码图片
  req.session['imageCode'] = captcha.text
  console.log('req.session[]', req.session['imageCode'])
  res.setHeader('Content-Type', 'image/svg+xml')
  res.send(captcha.data)
})

router.post('/possport/register', (req, res) => {
  (async function() {
    const { username, image_code, password } = req.body
    if (!(username && image_code && password)) {
      return res.send({ code: '4', msg: '缺少参数' })
    }
    if (image_code.toLowerCase() !== req.session['imageCode'].toLowerCase()) {
      return res.json({ code: '4', msg: '验证码填写错误' })
    }
    const result = await handleDB(res, 'info_user', 'find', '数据库查询出错', `username="${username}"`)
    if (result[0]) {
      res.json({ code: '3', msg: '用户名已被注册' })
    }
    // 数据插入
    const result2 = await handleDB(res, 'info_user', 'insert', '数据库查询出错', {
      username,
      password_hash: md5(md5(password) + password), // 双重md5加盐加秘方式
      nick_name: username,
      last_login: new Date().toLocaleDateString()
    })
    // 保持登录状态
    req.session['user_id'] = result2.insertId // 插入成功会返回id
    res.json({
      code: '0',
      msg: '注册成功'
    })
  })()
})

router.post('/possport/login', (req, res) => {
  (async function() {
    const { username, password } = req.body
    if (!(username && password)) {
      return res.json({
        code: '4',
        msg: '缺少参数'
      })
    }
    const result = await handleDB(req, 'info_user', 'find', '数据库查询出错', `username="${username}"`)
    if (!result[0]) {
      return res.json({
        code: '4',
        msg: '用户未注册'
      })
    }
    console.log('md5(md5(password) + password)', md5(md5(password) + password))
    console.log('result[0].password_hash', result[0].password_hash)
    if (md5(md5(password) + password_key) !== result[0].password_hash) {
      return res.json({
        code: '4',
        msg: '用户密码错误'
      })
    }
    req.session['user_id'] = result[0].id
    await handleDB(res, 'info_user', 'update', '数据库修改出错', `id=${result[0].id}`, {
      last_login: new Date().toLocaleDateString(),
    })
    
    res.json({
      code: '0',
      msg: '登录成功',
      data: result[0],
    })
  })()
})

router.post('/possport/logout', (req, res) => {
  delete req.session['user_id']
  res.json({
    code: '0',
    msg: '退出成功'
  })
})

router.get('/possport/category', (req, res) => {
  (async function() {
    const result = await handleDB(res, 'info_category', 'find', '查询分类报错', ['name', 'id'])
    res.send(result)
  })()
})

router.get('/possport/rank', (req, res) => {
  (async function() {
    const result = await handleDB(res, 'info_news', 'sql', '查询排行列表报错', 'select * from info_news order by clicks desc limit 6')
    res.send(result)
  })()
})

router.post('/possport/newsList', (req, res) => {
  (async function () {
    const { cid = 2, page = 1, size = 5 } = req.body
    const condition = cid === 1 ? '1' : `category_id=${cid}`
    const result = await handleDB(res, 'info_news', 'limit', '数据库查询报错', {
      where: `${ condition } order by create_time desc`,
      number: page,
      count: size,
    })
    const result2 = await handleDB(res, 'info_news', 'sql', '数据库查询报错', `select count(*) from info_news where ${condition}`)
    const totalPage = Math.ceil(result2[0]['count(*)'] / size)
    res.json({
      code: '0',
      msg: '获取列表成功',
      data: result || [],
      currentPage: Number(page),
      totalPage,
    })
  })()
})

router.get('/possport/detail/:id', (req, res) => {
  (async function () {
    const userId = req.session['user_id']
    console.log('userId', userId)
    const { id } = req.params
    let isCollected = false
    let isFollow = false
    let authorInfo = {}
    let followerList = []
    const result = await handleDB(res, 'info_news', 'find', '数据库查询报错', `id=${id}`)
    result[0].clicks += 1
    await handleDB(res, 'info_news', 'update', '数据库更新报错', `id=${id}`, { clicks: result[0].clicks })
    const comments = await handleDB(res, 'info_comment', 'find', '查询数据库报错', `news_id=${id} order by create_time desc`)
    if (userId) {
      const collecteds = await handleDB(res, 'info_user_collection', 'find', '查询数据库报错', `user_id = ${userId} and news_id = ${result[0].id}`)
      isCollected = collecteds[0] ? true : false
      let author = await handleDB(res, 'info_user', 'find', '查询数据库报错', `id=${result[0].user_id}`)
      author = { ...author[0] }
      authorInfo = {
        nickName: author.nick_name,
        avatar_url: author.avatar_url,
        signature: author.signature,
        id: author.id
      }
      console.log('authorInfo', authorInfo)
      const followers = await handleDB(res, 'info_user_fans', 'find', '查询数据库报错', `follower_id = ${userId}`)
      followerList = followers.map(item => item.followed_id)
      isFollow = followerList.includes(author.id) ? true : false
    }
    const newsCount = await handleDB(res, 'info_news', 'sql', '查询数据库报错', `select count(*) from info_news where user_id =${userId}` )
    const fansCount = await handleDB(res, 'info_user_fans', 'sql', '查询数据库报错', `select count(*) from info_user_fans where followed_id = ${userId}`)
    result[0].comments = comments
    result[0].isCollected = isCollected
    res.json({
      code: '0',
      msg: '查询成功',
      data: {
        ...result[0],
        newsCount: newsCount[0]['count(*)'],
        fansCount: fansCount[0]['count(*)'],
        authorInfo: { ...authorInfo, isFollow }
      }
    })
  })()
})

router.post('/possport/collected', (req, res) => {
  (async function () {
    const { newsId, action } = req.body
    const userId = req.session['user_id']
    if (!userId) {
      return res.json({
        code: '4',
        msg: '请先登录',
        data: null
      })
    }
    if (!(newsId && action)) {
      return res.json({
        code: '4',
        msg: '参数为空',
        data: null
      })
    }
    const news = await handleDB(res, 'info_news', 'find', '查询数据库报错', `id=${newsId}`)
    if (!news[0]) {
      return res.json({
        code: '4',
        msg: '未查询到当前新闻',
        data: null
      })
    }
    // 0 取消收藏 1 收藏
    if (action === '0') {
      await handleDB(res, 'info_user_collection', 'delete', '删除数据失败', `news_id = ${newsId} and user_id = ${userId}`)
    } else {
      await handleDB(res, 'info_user_collection', 'insert', '更新数据库失败',
      {
        news_id: newsId,
        user_id: userId
      })
    }

    res.json({
      code: '0',
      msg: '操作成功'
    })
  })()
})

router.post('/possport/followed', (req, res) => {
  (async function () {
    const { id: userId } = await getUserInfo(req, res)
    const { id, action } = req.body
    if (!userId) {
      return res.json({
        code: '4',
        msg: '请先登录'
      })
    }
    if ((!(id && action)) || id === userId) {
      return res.json({
        code: '4',
        msg: '参数错误'
      })
    }
    const users = await handleDB(res, 'info_user', 'find', '查询数据库报错', `id=${id}`)
    if (!users[0]) {
      return res.json({
        code: '4',
        msg: '未查询到被关注者'
      })
    }
    if (action !== '0') {
      await handleDB(res, 'info_user_fans', 'insert', '添加数据失败', {
        follower_id: userId,
        followed_id: id
      })
    } else {
      await handleDB(res, 'info_user_fans', 'delete', '取消关注失败', `followed_id = ${id}`)
    }
    res.json({
      code: '0',
      msg: '操作成功'
    })
  })()
})

router.post('/possport/addComment', (req, res) => {
  (async function () {
    const userId = req.session['user_id']
    const { newsId, content, parentId } = req.body
    if (!userId) {
      return res.json({
        code: '4',
        msg: '用户未登录'
      })
    }
    if (!(newsId && content)) {
      return res.json({
        code: '4',
        msg: '未获取到参数'
      })
    }
    const userinfo = await getUserInfo(req, res)
    const { nick_name, avatar_url } = userinfo
    const commentObj = {
      user_id: userId,
      news_id: newsId,
      create_time: new Date().toLocaleDateString(),
      content,
      nick_name,
      avatar_url: avatar_url || ''
    }
    if (parentId) {
      commentObj.parent_id = parentId
    }
    await handleDB(res, 'info_comment', 'insert', '插入数据库报错', commentObj)
    res.json({
      code: '0',
      msg: '评价成功',
    })
  })()
})

router.get('/possport/getComments', (req, res) => {
  (async function () {
    const { id } = req.query
    const comments = await handleDB(res, 'info_comment', 'find', '查询数据库报错', `news_id = ${id}`)
    res.json({
      code: '0',
      msg: '获取评论成功',
      data: comments
    })
  })()
})

router.post('/possport/updateComment', (req, res) => {
  (async function () {
    const userinfo = await getUserInfo(req, res)
    const { action, commentId } = req.body
    if (!userinfo.id) {
      return res.json({
        code: '4',
        msg: '用户未登录'
      })
    }
    if (!(action && commentId)) {
      return res.json({
        code: '4',
        msg: '未获取到参数'
      })
    }
    const result = await handleDB(res, 'info_comment', 'find', '查询数据库报错', `id = ${commentId}`)
    console.log('result', result)
    if (!result[0]) {
      return res.json({
        code: '4',
        msg: '未查询到相关评论'
      })
    }
    let likeCount = 0
    console.log('userinfo', userinfo)
    if (action !== '0') {
      likeCount = result[0].like_count ? result[0].like_count + 1 : 1
      await handleDB(res, 'info_comment_like', 'insert', '更新数据库失败', {
        comment_id: commentId,
        user_id: userinfo.id,
      })
    } else {
      likeCount = result[0].like_count ? result[0].like_count - 1 : 0
      await handleDB(res, 'info_comment_like', 'delete', '删除数据失败', `comment_id = ${commentId} and user_id = ${userinfo.id}`)
    }
    await handleDB(res, 'info_comment', 'update', '更新数据报错', `id = ${commentId}`, { like_count: likeCount })
    res.json({
      code: '0',
      msg: '操作成功'
    })
  })()
})

router.get('/possport/getProfile', (req, res) => {
  (async function () {
    const userinfo = await getUserInfo(req, res)
    res.json({
      code: '0',
      msg: '查询成功',
      data: userinfo[0]
    })
  })()
})

router.post('/possport/updateProfile', (req, res) => {
  (async function () {
    const { id } = await getUserInfo(req, res)
    console.log('id', id)
    const { signature, gender, nickName } = req.body
    if (!id) {
      return res.json({
        code: '4',
        msg: '用户未登录'
      })
    }
    if (!(signature && gender && nickName)) {
      return res.json({
        code: '4',
        msg: '参数错误'
      })
    }
    await handleDB(res, 'info_user', 'update', '修改个人信息失败', `id = ${id}`, {
      gender: gender,
      signature: signature,
      nick_name: nickName
    })
    res.json({
      code: '0',
      msg: '修改个人信息成功'
    })
  })()
})

router.post('/possport/updatePassword', (req, res) => {
  (async function () {
    const { id, password_hash } = await getUserInfo(req, res)
    const { oldPassword, newPassword, repeatPassword } = req.body
    if (!id) {
      return res.json({
        code: '4',
        msg: '用户未登录'
      })
    }
    if (!(oldPassword && newPassword && repeatPassword)) {
      return res.json({
        code: '4',
        msg: '参数错误'
      })
    }
  
    if (newPassword !== repeatPassword) {
      return res.json({
        code: '4',
        msg: '两次密码不一致'
      })
    }
    if (md5(md5(oldPassword) + password_key) !== password_hash) {
      return res.json({
        code: '4',
        msg: '旧密码输入错误'
      })
    }
    await handleDB(res, 'info_user', 'update', '用户密码修改失败', `id = ${id}`, {
      password_hash: md5(md5(newPassword) + password_key)
    })
    res.json({
      code: '0',
      msg: '修改密码成功'
    })
  })()
})

router.post('/possport/uploadAvatar', upload.single("file"), (req, res) => {
  (async function () {
    const { file } = req
    const imgUrl = 'http://r9e4ixvzw.hn-bkt.clouddn.com/image/'
    const { id } = await getUserInfo(req, res)
    const uploadObj = await uploadFile(file.originalname, `${file.destination}/${file.filename}`)
    console.log('uploadObj', uploadObj)
    await handleDB(res, 'info_user', 'update', '修改头像失败', `id=${id}`, {
      avatar_url: `${imgUrl}${file.originalname}`
    })
    res.json({
      code: '0',
      msg: '修改成功',
      data: `${imgUrl}${file.originalname}`
    })
  })()
})

router.get('/possport/getCollections', (req, res) => {
  (async function () {
    const { id } = await getUserInfo(req, res)
    const { page = 1, size = 10 } = req.query
    if (!id) {
      return res.json({
        code: '4',
        msg: '用户未登录'
      })
    }
    const totalCount = await handleDB(res, 'info_user_collection', 'sql', '查询收藏列表报错', `select count(*) from info_user_collection where user_id = ${id}`)
    const totalPage = Math.ceil(totalCount[0]['count(*)']/size)
    const result = await handleDB(res, 'info_user_collection', 'find', '查询数据库报错', `user_id = ${id} limit ${(page - 1) * size}, ${size}`)
    const newsIds = result.map(item => item.news_id).join()
    const collectionList = await handleDB(res, 'info_news', 'sql', '查询新闻列表报错', `select title, create_time from info_news WHERE id IN(${newsIds})`)
    res.json({
      currentPage: page,
      totalPage,
      data: collectionList
    })
  })()
})

router.post('/possport/test', (req, res) => {
  res.send({
    code: '0',
    msg: '测试通过'
  })
})

// jwt 验证方式
router.get('/possport/getToken', (req, res) => {
  const token = jwt.sign({
    id: 1,
    username: 'zhangsan'
  },
  password_key, // 自定义加密key
  {
    expiresIn: 60 * 60 * 2, // 过期时间，单位 秒
  })
  res.json({
    msg: '获取token成功',
    data: {
      token
    }
  })
})

exports.router = router
