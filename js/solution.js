'use strict';

const
  ws = 'https://neto-api.herokuapp.com',
  wrapApp = document.querySelector('.app'),
  currentImage = document.querySelector('.current-image'),
  imageLoader = document.querySelector('.image-loader'),
  wrapForCanvas = document.createElement('div'),
  canvas = document.createElement('canvas'),
  errorFileType = 'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.',
  errorDragLoad = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню',
  ctx = canvas.getContext('2d'),
  PEN_THICK = 4;

let
  movedBox = null,
  minY, minX, maxX, maxY,
  shiftX = 0, shiftY = 0,
  connection,
  getData,
  showComments = {},
  currentColor,
  url = new URL(`${window.location.href}`),
  paramId = url.searchParams.get('id'),
  curves = [],
  drawing = false,
  needsRepaint = false;

setGlobalVar('error');
setGlobalVar('menu');
setGlobalVar('burger');
setGlobalVar('comments__form');

//-------------------------
// Drag and drop actions

document.addEventListener('mousedown', dragElem);
document.addEventListener('mousemove', throttle(drag));
document.addEventListener('mouseup', drop);

// хватаем элемент
function dragElem(event) {
  if (!event.target.classList.contains('drag')) {
    return;
  }

  movedBox = event.target.parentElement;

  minX = wrapApp.offsetLeft + 1;
  minY = wrapApp.offsetTop + 1;
  maxX = wrapApp.offsetLeft + wrapApp.offsetWidth - movedBox.offsetWidth - 1;
  maxY = wrapApp.offsetTop + wrapApp.offsetHeight - movedBox.offsetHeight - 1;

  shiftX = event.pageX - event.target.getBoundingClientRect().left - window.pageXOffset;
  shiftY = event.pageY - event.target.getBoundingClientRect().top - window.pageYOffset;
}

// перемещаем элемент
function drag(event) {
  if (!movedBox) {
    return;
  }

  let x = event.pageX - shiftX;
  let y = event.pageY - shiftY;
  x = Math.min(x, maxX);
  y = Math.min(y, maxY);
  x = Math.max(x, minX);
  y = Math.max(y, minY);
  movedBox.style.left = x + 'px';
  movedBox.style.top = y + 'px';
}

// отпускаем элемент
function drop(event) {
  if (movedBox) {
    movedBox = null;
  }
}

// ограничение частоты запуска функции для обработчика события
function throttle(func, delay = 0) {
  let isWaiting = false;

  return function (...res) {
    if (!isWaiting) {
      func.apply(this, res);
      isWaiting = true;
      setTimeout(() => {
        isWaiting = false;
      }, delay);
    }
  }
}

//-------------------------
// Publication

// очистка фона
currentImage.src = '';

// меню в режим публикации
getGlobalVar('menu').dataset.state = 'initial';
wrapApp.dataset.state = '';

hideElement(getGlobalVar('burger'));

// удаление форм с комментариями
wrapApp.removeChild(document.querySelector('.comments__form'));

// событие окна выбора загрузки файла для элемента "menu__item mode new"
getGlobalVar('menu').querySelector('.new').addEventListener('click', uploadDataFile);

// события drag&drop для загрузки файла перетаскиванием на элемент "wrap app"
wrapApp.addEventListener('drop', eventFileDrop);
wrapApp.addEventListener('dragover', event => event.preventDefault());

// функция загрузки файла
function uploadDataFile(event) {
  hideElement(getGlobalVar('error'));
  const input = document.createElement('input');
  input.setAttribute('id', 'fileInput');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/jpeg, image/png');
  hideElement(input);
  getGlobalVar('menu').appendChild(input);

  document.querySelector('#fileInput').addEventListener('change', event => {
    const files = Array.from(event.currentTarget.files);

    if (currentImage.dataset.load === 'load') {
      removeForm();
      curves = [];
    }

    imNotTeapot(files);
  });

  input.click();
  getGlobalVar('menu').removeChild(input);
}

// удаление форм комментариев после загрузки нового файла
function removeForm() {
  const formComment = wrapApp.querySelectorAll('.comments__form');
  Array.from(formComment).forEach(item => {
    item.remove()
  });
}

// функция загрузки для drag & drop
function eventFileDrop(event) {
  event.preventDefault();
  hideElement(getGlobalVar('error'));
  const files = Array.from(event.dataTransfer.files);

  if (currentImage.dataset.load === 'load') {
    showElement(getGlobalVar('error'));
    getGlobalVar('error').lastElementChild.textContent = errorDragLoad;
    hideErr();
    return;
  }

  imNotTeapot(files);
}

// проверка загружаемого файла на соответствие типу изображение
function imNotTeapot(files) {
  files.forEach(file => {
    if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
      transmitFile(files);
    } else {
      showElement(getGlobalVar('error'));
      getGlobalVar('error').lastElementChild.textContent = errorFileType;
      hideErr();
    }
  });
}

// отправка файла на сервер
function transmitFile(files) {
  const formData = new FormData();

  files.forEach(file => {
    const fileTitle = removePostfix(file.name);
    formData.append('title', fileTitle);
    formData.append('image', file);
  });

  showElement(imageLoader);

  fetch(`${ws}/pic`, {
    body: formData,
    credentials: 'same-origin',
    method: 'POST'
  })
    .then(res => {
      if (res.status >= 200 && res.status < 300) {
        return res;
      }
      throw new Error(res.statusText);
    })
    .then(res => res.json())
    .then(res => {
      getFileInfo(res.id);
    })
    .catch(er => {
      hideElement(imageLoader);
      showElement(getGlobalVar('error'));
      getGlobalVar('error').lastElementChild.textContent = er;
      hideErr();
    });
}

// получение информации с сервера
function getFileInfo(id) {
  const xhrGetInfo = new XMLHttpRequest();
  xhrGetInfo.open(
    'GET',
    `${ws}/pic/${id}`,
    false
  );
  xhrGetInfo.send();

  getData = JSON.parse(xhrGetInfo.responseText);
  localStorage.host = `${window.location.origin}${window.location.pathname}?id=${getData.id}`;
  wss();
  addBackground(getData);
  getGlobalVar('burger').style.display = '';
  showMenu();

  currentImage.addEventListener('load', () => {
    hideElement(imageLoader);
    addWrapforCanvsComm();
    createCanvas();
    currentImage.dataset.load = 'load';
  });

  history.pushState('', '', localStorage.host);

  reupdCommsForm(getData.comments);
}

//-------------------------
// Reviewing

//раскрытие меню по событию клика на элементе "menu__item burger"
getGlobalVar('burger').addEventListener('click', showMenu);

//при клике на холст проверяет есть ли форма комментария в этом месте, если нет создает новую
canvas.addEventListener('click', checkComment);

//переключатели открыть/скрыть форму комментария
document.querySelector('.menu__toggle-title_on').addEventListener('click', markCheckboxOn);
document.querySelector('#comments-on').addEventListener('click', markCheckboxOn);
document.querySelector('.menu__toggle-title_off').addEventListener('click', markCheckboxOff);
document.querySelector('#comments-off').addEventListener('click', markCheckboxOff);

//вызов функции копирования ссылки в буфер по клику на элементе "menu_copy"
getGlobalVar('menu').querySelector('.menu_copy').addEventListener('click', replicate);
checkurlId(paramId);

// цвета для пера
Array.from(getGlobalVar('menu').querySelectorAll('.menu__color')).forEach(color => {
  if (color.checked) {
    currentColor = getComputedStyle(color.nextElementSibling).backgroundColor;
  }
  color.addEventListener('click', (event) => {
    currentColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor;
  });
});

// рисование
canvas.addEventListener("mousedown", (event) => {
  if (!(getGlobalVar('menu').querySelector('.draw').dataset.state === 'selected')) return;
  drawing = true;

  const curve = [];
  curve.color = currentColor;

  curve.push(makePoint(event.offsetX, event.offsetY));
  curves.push(curve);
  needsRepaint = true;
});

canvas.addEventListener("mouseup", (event) => {
  getGlobalVar('menu').style.zIndex = '1';
  drawing = false;
});

canvas.addEventListener("mouseleave", (event) => {
  drawing = false;
});

canvas.addEventListener("mousemove", (event) => {
  if (drawing) {
    getGlobalVar('menu').style.zIndex = '0';
    curves[curves.length - 1].push(makePoint(event.offsetX, event.offsetY));
    needsRepaint = true;
    debounceSendMask();
  }
});

const debounceSendMask = debounce(sendMaskState, 1000);

tick();

//закрытие соединения при уходе со страницы
window.addEventListener('beforeunload', () => {
  connection.close();
  console.log('Веб-сокет закрыт')
});

// инициализация хранилища
function getGlobalStorage() {
  if (typeof(window['globalStorage']) === 'undefined') {
    window.globalStorage = {};
  }
  return window.globalStorage;
}

// задание переменной в хранилище
function setGlobalVar(arg) {
  let storage = getGlobalStorage();

  storage[arg] = document.querySelector(`.${arg}`);
}

// получение переменной из хранилища
function getGlobalVar(arg) {
  let storage = getGlobalStorage();
  return storage[arg];
}

// функция копирования ссылки в буфер
function replicate() {
  getGlobalVar('menu').querySelector('.menu__url').select();
  try {
    let successful = document.execCommand('copy');
    let msg = successful ? 'успешно ' : 'не';
    console.log(`URL ${msg} скопирован`);
  } catch (err) {
    console.log('Ошибка копирования');
  }
  window.getSelection().removeAllRanges();
}

// удаление расширения файла
function removePostfix(inputText) {
  let regExp = new RegExp(/\.[^.]+$/gi);

  return inputText.replace(regExp, '');
}

// форматирование даты и времени
function dataTime(timestamp) {
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  const date = new Date(timestamp);
  const dateStr = date.toLocaleString('ru-RU', options);

  return dateStr.slice(0, 8) + dateStr.slice(9);
}

// сокрытие сообщений
function hideErr() {
  setTimeout(function () {
    hideElement(getGlobalVar('error'))
  }, 7000);
}

// функции скрытия/отображения элементов
function hideElement(el) {
  el.style.display = 'none';
}

function showElement(el) {
  el.style.display = '';
}

// отбражение пунктов меню
function showMenu() {
  getGlobalVar('menu').dataset.state = 'default';

  Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
    modeItem.dataset.state = '';
    modeItem.addEventListener('click', () => {

      if (!modeItem.classList.contains('new')) {
        getGlobalVar('menu').dataset.state = 'selected';
        modeItem.dataset.state = 'selected';
      }

      if (modeItem.classList.contains('share')) {
        getGlobalVar('menu').querySelector('.menu__url').value = localStorage.host;
      }
    })
  })
}

// отображение меню комментарии
function revealComments() {
  getGlobalVar('menu').dataset.state = 'default';

  Array.from(getGlobalVar('menu').querySelectorAll('.mode')).forEach(modeItem => {
    if (!modeItem.classList.contains('comments')) {
      return;
    }

    getGlobalVar('menu').dataset.state = 'selected';
    modeItem.dataset.state = 'selected';
  })
}

// добавление фона
function addBackground(fileInfo) {
  currentImage.src = fileInfo.url;
}

// функции переключения чекбокса для отображения/скрытия форм комментариев
function markCheckboxOff() {
  const forms = document.querySelectorAll('.comments__form');
  Array.from(forms).forEach(form => {
    form.style.display = 'none';
  })
}

function markCheckboxOn() {
  const forms = document.querySelectorAll('.comments__form');
  Array.from(forms).forEach(form => {
    form.style.display = '';
  })
}

// функция добавления формы комментариев по клику
function checkComment(event) {
  if (!(getGlobalVar('menu').querySelector('.comments').dataset.state === 'selected') || !wrapApp.querySelector('#comments-on').checked) {
    return;
  }
  wrapForCanvas.appendChild(addCommentForm(event.offsetX, event.offsetY));
}

// создание холста
function createCanvas() {
  const width = getComputedStyle(wrapApp.querySelector('.current-image')).width.slice(0, -2);
  const height = getComputedStyle(wrapApp.querySelector('.current-image')).height.slice(0, -2);
  canvas.width = width;
  canvas.height = height;

  Object.assign(canvas.style, {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: '0',
    left: '0',
    display: 'block',
    zIndex: '1'
  });

  wrapForCanvas.appendChild(canvas);
}

// задание зоны для создания форм комментариев и их отображения поверх
function addWrapforCanvsComm() {
  const width = getComputedStyle(wrapApp.querySelector('.current-image')).width;
  const height = getComputedStyle(wrapApp.querySelector('.current-image')).height;

  Object.assign(wrapForCanvas.style, {
    width: `${width}`,
    height: `${height}`,
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'block'
  });

  wrapApp.appendChild(wrapForCanvas);

  wrapForCanvas.addEventListener('click', event => {
    if (event.target.closest('form.comments__form')) {
      Array.from(wrapForCanvas.querySelectorAll('form.comments__form')).forEach(form => {
        form.style.zIndex = 2;
      });
      event.target.closest('form.comments__form').style.zIndex = 3;
    }
  });
}

// добавление формы комментариев
function addCommentForm(x, y) {
  const formComment = getGlobalVar('comments__form').cloneNode(true);

  formComment.querySelectorAll('.comment').forEach(divForRemove => {
    if (!divForRemove.querySelector('.loader')) {
      divForRemove.remove();
    }
  });

  const left = x - 22;
  const top = y - 14;

  formComment.style.top = `${top}px`;
  formComment.style.left = `${left}px`;
  formComment.style.zIndex = '2';
  formComment.dataset.left = left;
  formComment.dataset.top = top;

  hideElement(formComment.querySelector('.loader').parentElement);

  formComment.querySelector('.comments__close').addEventListener('click', () => {
    formComment.querySelector('.comments__marker-checkbox').checked = false;
  });

  formComment.addEventListener('submit', sendMsgs);

  function sendMsgs(event) {
    if (event) {
      event.preventDefault();
    }
    const message = formComment.querySelector('.comments__input').value;
    const messageSend = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
    commentsSend(messageSend);
    showElement(formComment.querySelector('.loader').parentElement);
    formComment.querySelector('.comments__input').value = '';
  }

  function commentsSend(message) {
    fetch(`${ws}/pic/${getData.id}/comments`, {
      method: 'POST',
      body: message,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    })
      .then(res => {
        if (res.status >= 200 && res.status < 300) {
          return res;
        }
        throw new Error(res.statusText);
      })
      .then(res => res.json())
      .catch(er => {
        console.log(er);
        formComment.querySelector('.loader').parentElement.style.display = 'none';
      });
  }

  return formComment;
}

// добавление комментраия в форму
function addMessageComment(message, form) {
  let parentLoaderDiv = form.querySelector('.loader').parentElement;

  const newMessageDiv = document.createElement('div');
  newMessageDiv.classList.add('comment');
  newMessageDiv.dataset.timestamp = message.timestamp;

  const commentTimeP = document.createElement('p');
  commentTimeP.classList.add('comment__time');
  commentTimeP.textContent = dataTime(message.timestamp);
  newMessageDiv.appendChild(commentTimeP);

  const commentMessageP = document.createElement('p');
  commentMessageP.classList.add('comment__message');
  commentMessageP.textContent = message.message;
  newMessageDiv.appendChild(commentMessageP);

  form.querySelector('.comments__body').insertBefore(newMessageDiv, parentLoaderDiv);
}

// обновление форм комментариев
function updCommsForm(newComment) {
  if (!newComment) return;
  Object.keys(newComment).forEach(id => {
    if (id in showComments) return;

    showComments[id] = newComment[id];
    let needCreateNewForm = true;

    Array.from(wrapApp.querySelectorAll('.comments__form')).forEach(form => {
      if (+form.dataset.left === showComments[id].left && +form.dataset.top === showComments[id].top) {
        form.querySelector('.loader').parentElement.style.display = 'none';
        addMessageComment(newComment[id], form);
        needCreateNewForm = false;
      }
    });

    if (needCreateNewForm) {
      const newForm = addCommentForm(newComment[id].left + 22, newComment[id].top + 14);
      newForm.dataset.left = newComment[id].left;
      newForm.dataset.top = newComment[id].top;
      newForm.style.left = newComment[id].left + 'px';
      newForm.style.top = newComment[id].top + 'px';
      wrapForCanvas.appendChild(newForm);
      addMessageComment(newComment[id], newForm);

      if (!wrapApp.querySelector('#comments-on').checked) {
        newForm.style.display = 'none';
      }
    }
  });
}

// восстановление форм комментариев
function reupdCommsForm(newComment) {
  if (!newComment) return;

  for (let id in newComment) {
    let comment = newComment[id];
    let newForm = addCommentForm(comment.left + 22, comment.top + 14);
    wrapForCanvas.appendChild(newForm);

    for (let id in newComment) {
      if (newComment[id].left === comment.left && newComment[id].top === comment.top) {
        addMessageComment(newComment[id], newForm);
        delete newComment[id];
      }
    }
  }
}

//добавление комментариев с сервера
function insertWssCommentForm(wssComment) {
  const wsCommentEdited = {};
  wsCommentEdited[wssComment.id] = {};
  wsCommentEdited[wssComment.id].left = wssComment.left;
  wsCommentEdited[wssComment.id].message = wssComment.message;
  wsCommentEdited[wssComment.id].timestamp = wssComment.timestamp;
  wsCommentEdited[wssComment.id].top = wssComment.top;
  updCommsForm(wsCommentEdited);
}

function wss() {
  connection = new WebSocket(`wss://neto-api.herokuapp.com/pic/${getData.id}`);
  connection.addEventListener('message', event => {
    if (JSON.parse(event.data).event === 'pic') {
      if (JSON.parse(event.data).pic.mask) {
        canvas.style.background = `url(${JSON.parse(event.data).pic.mask})`;
      } else {
        canvas.style.background = ``;
      }
    }

    if (JSON.parse(event.data).event === 'comment') {
      insertWssCommentForm(JSON.parse(event.data).comment);
    }

    if (JSON.parse(event.data).event === 'mask') {
      canvas.style.background = `url(${JSON.parse(event.data).url})`;
    }
  });
}

//проверка ссылки
function checkurlId(id) {
  if (!id) {
    return;
  }
  getFileInfo(id);
  revealComments();
}

//запуск функции после завершения события
function debounce(func, delay = 0) {
  let timeout;

  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func();
    }, delay);
  };
}

// перо
function circle(point) {
  ctx.beginPath();
  ctx.arc(...point, PEN_THICK / 2, 0, 2 * Math.PI);
  ctx.fill();
}

// рисование кривой
function smoothCurveBetween(p1, p2) {
  const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
  ctx.quadraticCurveTo(...p1, ...cp);
}

function smoothCurve(points) {
  ctx.beginPath();
  ctx.lineWidth = PEN_THICK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.moveTo(...points[0]);

  for (let i = 1; i < points.length - 1; i++) {
    smoothCurveBetween(points[i], points[i + 1]);
  }

  ctx.stroke();
}

function makePoint(x, y) {
  return [x, y];
}

// перерисовка холста
function redrawing() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  curves.forEach((curve) => {
    ctx.strokeStyle = curve.color;
    ctx.fillStyle = curve.color;

    circle(curve[0]);
    smoothCurve(curve);

  });
}

// отправка холста на сервер
function sendMaskState() {
  canvas.toBlob(function (blob) {
    connection.send(blob);
    console.log(connection);
  });
}

// анимация для смещения меню при развертывании у правого края окна и для перерисовки холста
function tick() {
  if (getGlobalVar('menu').offsetHeight > 66) {
    getGlobalVar('menu').style.left = (wrapApp.offsetWidth - getGlobalVar('menu').offsetWidth) - 10 + 'px';
  }

  if (needsRepaint) {
    redrawing();
    needsRepaint = false;
  }

  window.requestAnimationFrame(tick);
}