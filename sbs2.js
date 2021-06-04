const axios = require('axios');

const SBS2_API_URL = 'https://smilebasicsource.com/api/';

class MessageLongPoller {
  constructor(callback, authtoken) {
    this.callback = callback;
    this.authtoken = authtoken;

    // get an initial poll so that we can get the last ID sent
    const commentSettings = JSON.stringify({
      reverse: true,
      limit: 1
    });

    axios.get(`${SBS2_API_URL}Read/chain?requests=comment-` +
              `${commentSettings}&requests=user.0createUserId&` +
              'content.0parentId', {
                headers: {
                  Authorization: `Bearer ${this.authtoken}`
                }
              })
      .then(response => {
        this.lastId = response.data['comment'][0]['id'];
        this.timer = setImmediate(this.runForever.bind(this));
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  runForever() {
    const listenerSettings = JSON.stringify({
      lastId: this.lastId,
      chains: ['comment.0id', 'user.1createUserId', 'content.1parentId']
    });

    const url = `${SBS2_API_URL}Read/listen?actions=${listenerSettings}`;

    try {
      axios.get(url, {headers: {Authorization: `Bearer ${this.authtoken}`}})
        .then(response => {
          this.lastId = response.data['lastId'];
          this.callback(response.data['chains']);
          this.timer = setImmediate(this.runForever.bind(this));
        })
        .catch(function (err) {
          console.error(err);
        });
    } catch (e) {
      console.err(e);
    }
  }
}

class SBS2 {
  constructor(pullCallback, authtoken = '') {
    this.pullCallback = pullCallback;
    this.authtoken = authtoken;
  }

  async login(username, password) {
    try {
      let response = await axios.post(`${SBS2_API_URL}User/Authenticate`, {username, password});
      this.authtoken = response.data;
    } catch (err) {
      console.error(err);
    }
  }

  async connect() {
    if (this.authtoken === '')
      throw 'An authtoken hasn\'t been set for the SBS2 instance.';

    try {
      let response = await axios.get(`${SBS2_API_URL}User/me`, {
        headers: {Authorization: `Bearer ${this.authtoken}`}
      });
      this.userid = response['id'];
      this.longpoller = new MessageLongPoller(this.pullCallback, 
        this.authtoken);
    } catch (err) {
      console.error(err);
    }
  }

  async sendMessage(roomId, content, settings={m: '12y'}) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authtoken}`
    };
    const data = {
      parentId: roomId,
      content: `${JSON.stringify(settings)}\n${content}`
    };
    const url = `${SBS2_API_URL}Comment`;

    try {
      await axios.post(url, {data, headers});
    } catch (err) {
      console.error(err);
    }
  }

  getAvatar(avatarId, size) {
    return `${SBS2_API_URL}File/raw${avatarId}?size=${size}&crop=true`;
  }
}

module.exports = SBS2;
