const app = {
  __modes__: ['startup'],
  __currentMode__: '',

  setCurrentMode: function(mode) {
    return this.__currentMode__ = mode;
  },
  getCurrentMode: function() {
    return this.__currentMode__;
  },

  hideMenu: function(menu) {
    Array.from(menu.children)
      .forEach((el) => el.classList.add('hidden'));
  },

  hideElements: function(...els) {
    Array.from(els)
      .forEach((el) => el.classList.add('hidden'));
  },
  showElements: function(...els) {
    Array.from(els)
      .forEach((el) => el.classList.remove('hidden'));
  },

  stateLoader: function(state) {
    const menu = document.querySelector('.menu');
    this[state](menu);
  },

  startup: function(menu) {
    this.hideMenu(menu);

    const dragMenu = document.querySelector('.drag'),
          uploadNewMenu = document.querySelector('.new');

    this.showElements(dragMenu, uploadNewMenu);
  },

  initialize: function() {
    this.setCurrentMode('startup');
    this.stateLoader(this.getCurrentMode());
  }
};

document.addEventListener('DOMContentLoaded', (evt) => {
  app.initialize();
});