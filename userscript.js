// ==UserScript==
// @name         burningseries-autoplay
// @namespace    https://github.com/zaheer-exe/burningseries-autoplay
// @version      4.5
// @description  Autoplay für Burningseries
// @author       zaheer-exe
// @match        https://bs.to/*
// @match        https://*.vivo.sx/*
// @match        https://burningseries.co/*
// @match        https://burningseries.nz/*
// @match        https://burningseries.cx/*
// @match        https://burningseries.vc/*
// @match        https://burningseries.sx/*
// @match        https://burningseries.se/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        window.close
// @grant        GM_xmlhttpRequest
// @require      http://code.jquery.com/jquery-latest.js
// @require      https://greasyfork.org/scripts/401626-notify-library/code/Notify%20Library.js?version=817875
// @license      Apache License
// ==/UserScript==

function createElementFromHTML(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

function waitForElem(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

class SiteHandler {
    constructor() {
        this.dataHandler = new DataHandler();
        this.url = new URL(document.location.href);
        this.settings = this.dataHandler.getSettings();
    }
}

class VivoHandler extends SiteHandler {
    constructor() {
        super();
        this.data = this.dataHandler.getEpisodeData(this.settings.lastBsUrl);
        if(this.settings.vivoEnabled && this.isVivo()) {
            this.play();
        }
        if(this.settings.vivoEnabled && this.isVivoVideo()){
            this.resize();
            this.trackWatchedState();
            if(this.settings.autonextEnabled) {
                this.onEndPlayNext();
            }
        }
        if(this.settings.vivoButtonsEnabled && this.isVivoVideo()){
            this.loadButtons();
        }
        if(this.settings.autoresumeEnabled) {
            this.resume();
        }
        if(this.isVivoVideo()) {
            this.saveVolume();
            if(this.data.isFiller) {
                new Notify({
                    text: 'Jetzt kommt eine Filler Folge!',
                    type: 'warn',
                    timeout: 5000
                }).show();
            }
        }
    }

    isVivo() {
        const vivoDomains = ['vivo.sx'];
        const currentUrl = new URL(document.location.href);

        return vivoDomains.includes(currentUrl.host);
    }

    isVivoVideo() {
        if(document.querySelector('video') && window.location.href.includes('vivo') && window.location.href.includes('--')) {
            return true;
        }

        return false;
    }

    loadButtons() {
        const button = `
            <div>
            <svg style="width:70px;height:70px" viewBox="0 0 24 24">
                <path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
             </svg>
            </div>`
        if(this.data.prev) {
            let prevButton = createElementFromHTML(button)
            prevButton.style.border = "10px solid rgba(0, 0, 0, 0.3)";
            prevButton.style.borderRadius = "30px";
            prevButton.style.position = 'absolute';
            prevButton.style.backgroundColor = 'lightgray';
            prevButton.style.left = '10px';
            prevButton.style.top = '50%';
            prevButton.style.transform = "rotate(180deg)";
            prevButton.style.visibility = 'hidden';

            prevButton.addEventListener('click', ()=>{
                window.location.href = this.data.prev + '/Vivo/' + (this.settings.bsEnabled ? '#autoplay' : '');
            });
            prevButton.classList.add('autoplay-button');
            document.body.append(prevButton);
        }
        if(this.data.next) {
            let nextButton = createElementFromHTML(button);
            nextButton.style.border = "10px solid rgba(0, 0, 0, 0.3)";
            nextButton.style.borderRadius = "30px";
            nextButton.style.position = 'absolute';
            nextButton.style.backgroundColor = 'lightgray';
            nextButton.style.top = '50%';
            nextButton.style.marginRight = "10px";
            nextButton.style.visibility = 'hidden';
            document.body.append(nextButton);
            nextButton.style.left = 'calc(100% - ' + (nextButton.offsetWidth + 10) + 'px)';
            nextButton.addEventListener('click', ()=>{
                window.location.href = this.data.next + '/Vivo/' + (this.settings.bsEnabled ? '#autoplay' : '');
            });
            nextButton.classList.add('autoplay-button');
        }
        let timer = null;
        document.body.addEventListener('mousemove', () => {
            if(timer) {
                clearTimeout(timer);
            }
            document.querySelectorAll('.autoplay-button').forEach(button => {
                button.style.visibility = 'visible';
            });
            timer = setTimeout(() => {
                document.querySelectorAll('.autoplay-button').forEach(button => {
                    button.style.visibility = 'hidden';
                });
            }, 1000);
        });
    }

    trackWatchedState() {
        let videoElem = document.querySelector('video');
        if (videoElem) {
            videoElem.addEventListener('progress', (event) => {
                let current = videoElem.currentTime;
                let duration = videoElem.duration;
                if (current && duration) {
                    this.data.currentTime = current;
                    this.data.maxTime = duration;
                    this.dataHandler.setEpisodeData(this.settings.lastBsUrl, this.data);
                }
            });
        }
    }

    // saveVolume code by WaGi-Coding (https://greasyfork.org/de/users/772124-wagi-coding) Thanks!
    saveVolume () {
        let videoElem = document.querySelector('video');
        videoElem.addEventListener('volumechange', (event) => {
            GM_setValue('volume', videoElem.volume);
            if(videoElem.muted) {
                GM_setValue('muted', true);
            } else {
                GM_setValue('muted', false);
            }
        });
        if(!isNaN(GM_getValue('volume'))) {
            videoElem.volume = GM_getValue('volume');
        }
        if(GM_getValue('muted')) {
            videoElem.muted = true;
        }
        else {
            videoElem.muted = false;
        }
    }

    onEndPlayNext() {
        let videoElem = document.querySelector('video');
        videoElem.onended = () => {
            let current = videoElem.currentTime;
            let duration = videoElem.duration;
            if (current && duration) {
                this.data.currentTime = current;
                this.data.maxTime = duration;
                this.dataHandler.setEpisodeData(this.settings.lastBsUrl, this.data);
            }
            let nextEpisode = this.data.next;
            let url = nextEpisode + '/Vivo/'
            if(this.settings.bsEnabled) {
                url += '#autoplay';
            }
            window.location.href = url;

        }
    }

    resize() {
        let video = document.querySelector("video");
        video.style.width = "100%";
        video.style.height = "100%";
        document.body.style.margin = "0px";

    }


    play() {
        // code by https://greasyfork.org/de/scripts/28779-zu-vivo-video-navigieren
        // Thank you!
        var source = document.getElementsByTagName('body')[0].innerHTML;
        if (source != null) {
            source = source.replace(/(?:.|\n)+Core\.InitializeStream\s*\(\s*\{[^)}]*source\s*:\s*'(.*?)'(?:.|\n)+/, "$1");
            var toNormalize = decodeURIComponent(source);
            var url = ""
            for (var i = 0; i < toNormalize.length; i++) {
                var c = toNormalize.charAt(i);
                if (c != ' ') {
                    var t = (function (c) { return c.charCodeAt == null ? c : c.charCodeAt(0); })(c) + '/'.charCodeAt(0);
                    if (126 < t) {
                        t -= 94;
                    }
                    url += String.fromCharCode(t);
                }
            }
            if (!url.toLowerCase().startsWith("http")) {
                alert("Vivo-Script Defect!");
                return;
            }
        }
        window.location.href = url;
    }

    resume() {
        let videoElem = document.querySelector('video');
        if ((this.data.currentTime !== this.data.maxTime) && videoElem) {
            videoElem.currentTime = this.data.currentTime;
        }
    }
}

class BsHandler extends SiteHandler {
    constructor() {
        super();
        if(this.isBs()) {
            this.settings = this.dataHandler.getSettings();
            this.loadMenu();
            if(this.dataHandler.getSettings().bsEnabled) {
                this.main();
            }
        }
    }
    isBs() {
        const bsDomains = ['bs.to', 'burningseries.co', 'burningseries.nz', 'burningseries.cx', 'burningseries.vc', 'burningseries.sx', 'burningseries.se'];
        const currentUrl = new URL(document.location.href);

        return bsDomains.includes(currentUrl.host);
    }

    loadMenu() {
        let css = document.createElement('style');
        let lastText = this.settings.lastVivoUrl ? `<h3><span>Weiterschauen: </span><a target="_blank" href="`+ this.settings.lastVivoUrl + `">` + this.settings.lastName + `</a></h3>` : '';
        css.innerHTML =
            `
            .bs-autoplay-menu {
                color: white;
                position: absolute;
                top: 0;
                z-index: 999;
                background: rgba(0,0,0,0.8);
                margin: 10px;
                padding: 5px;
                transition: 0.2s;
                overflow: hidden;
                white-space: nowrap;

            }
           .bs-autoplay-menu svg {
               transition: 0.2s;
               fill: gray;
           }
           .rotate {
               transform: rotate(90deg);
           }
           .title {
                display: inline-flex;
                transition: 0.2s;
           }
           .title h1 {
                transition: 0.2s;
                width: 100%;
            }
           .title > * {
               padding: 5px;
               display: inline;
           }
           .bs-autoplay-menu .cb {
               display: inline-block;
           }
           .bs-autoplay-menu a {
               color: red;
           }
        `
        let html = document.createElement('div');
        html.innerHTML =
            `
            <div class="bs-autoplay-menu">
                <div class="title">
                    <svg viewBox="0 0 100 80" width="40" height="40">
                        <rect width="100" height="20"></rect>
                        <rect y="30" width="100" height="20"></rect>
                        <rect y="60" width="100" height="20"></rect>
                    </svg>
                    <h1>Autoplay</h1>
                </div>
                `+lastText+`
                <div>
                    <div>
                        <span>autoplay bs: </span>
                        <input type="checkbox" class="cb toggle-button-bs">
                    </div>
                    <div>
                        <span>autoplay vivo: </span>
                        <input type="checkbox" class="cb toggle-button-vivo">
                    </div>
                    <div>
                        <span>automatisch nächste Folge abspielen: </span>
                        <input type="checkbox" class="cb toggle-button-autonext">
                    </div>
                    <div>
                        <span>fortsetzen wo du aufgehört hast: </span>
                        <input type="checkbox" class="cb toggle-button-autoresume">
                    </div>
                    <div>
                        <span>Buttons im Video anzeigen: </span>
                        <input type="checkbox" class="cb toggle-button-vivobuttons">
                    </div>
                </div>
            </div>
        `
        //<div>
        //       <span>Anime Filler Folgen automatisch überspringen: </span>
        //       <input type="checkbox" class="cb toggle-button-filler">
        // </div>
        html.querySelector('.toggle-button-bs').checked = this.settings.bsEnabled;
        html.querySelector('.toggle-button-bs').addEventListener('click', () => {
            this.settings.bsEnabled = !this.settings.bsEnabled;
            this.dataHandler.setSettings(this.settings);
            location.reload();
        });
        html.querySelector('.toggle-button-vivo').checked = this.settings.vivoEnabled;
        html.querySelector('.toggle-button-vivo').addEventListener('click', () => {
            this.settings.vivoEnabled = !this.settings.vivoEnabled;
            this.dataHandler.setSettings(this.settings);
            location.reload();
        });
        html.querySelector('.toggle-button-autonext').checked = this.settings.autonextEnabled;
        html.querySelector('.toggle-button-autonext').addEventListener('click', () => {
            this.settings.autonextEnabled = !this.settings.autonextEnabled;
            this.dataHandler.setSettings(this.settings);
            location.reload();
        });
        html.querySelector('.toggle-button-autoresume').checked = this.settings.autoresumeEnabled;
        html.querySelector('.toggle-button-autoresume').addEventListener('click', () => {
            this.settings.autoresumeEnabled = !this.settings.autoresumeEnabled;
            this.dataHandler.setSettings(this.settings);
            location.reload();
        });
        html.querySelector('.toggle-button-vivobuttons').checked = this.settings.vivoButtonsEnabled;
        html.querySelector('.toggle-button-vivobuttons').addEventListener('click', () => {
            this.settings.vivoButtonsEnabled = !this.settings.vivoButtonsEnabled;
            this.dataHandler.setSettings(this.settings);
            location.reload();
        });
        //html.querySelector('.toggle-button-filler').checked = this.settings.fillerEnabled;
        //html.querySelector('.toggle-button-filler').addEventListener('click', () => {
        //    this.settings.fillerEnabled = !this.settings.fillerEnabled;
        //    this.dataHandler.setSettings(this.settings);
        //    location.reload();
        //});
        document.body.append(css);
        document.body.append(html);

        let title = html.querySelector('.bs-autoplay-menu .title')
        let height = title.parentElement.offsetHeight;
        let width = title.parentElement.offsetWidth;
        let heightTitle = title.offsetHeight;
        let widthTitle = title.offsetWidth;
        let menu = html.querySelector('.bs-autoplay-menu');
        if(window.location.hash != '#open') {
            menu.style.width = widthTitle + 'px';
            menu.style.height = heightTitle + 'px';
        } else {
            menu.querySelector('svg').classList.toggle('rotate');
            menu.style.width = width + 'px';
            menu.style.height = height + 'px';
            title.style.width = width + 'px';
        }
        title.addEventListener('click', () => {
            menu.querySelector('svg').classList.toggle('rotate');
            if(window.location.hash != '#open') {
                window.location.hash = 'open';
                menu.style.width = width + 'px';
                title.style.width = width + 'px';
                menu.style.height = height + 'px';
            } else {
                window.location.hash = 'closed';
                menu.style.width = widthTitle + 'px';
                title.style.width = widthTitle + 'px';
                menu.style.height = heightTitle + 'px';
            }
        });
    }

    loadAutoplayButtons() {
        let episodeRows = document.querySelectorAll('.episodes tr');
        episodeRows.forEach((episode) => {
            let target = episode.querySelector('[title=\'Vivo\']');
            if (!target) {
                return;
            }
            target = target.parentElement;
            let buttonElem = document.createElement('button');
            buttonElem.innerHTML = 'Auto Play';
            buttonElem.addEventListener('click', () => {
                let url = episode.querySelector('a').href;
                window.open(url + '/Vivo/#autoplay');
            })
            target.prepend(buttonElem);
        });
        if(window.location.href.includes('autoplayFirst')) {
            episodeRows[0].querySelector('button').click();
            window.close();
        }
    }

    async setPrevAndNextEpisode() {
        await waitForElem("#episodes .active");
        let next = document.querySelector('#episodes .active').nextElementSibling;
        let prev = document.querySelector('#episodes .active').previousElementSibling;
        let data = this.dataHandler.getEpisodeData(this.url.pathname) || {};
        if(next) {
            next = next.querySelector('a').href;
        } else {
            next = document.querySelector('#seasons .active').nextElementSibling;
            if(next) {
                next = next.querySelector('a').href + '#autoplayFirst';
            }
        }
        if(prev) {
            prev = prev.querySelector('a').href;
        }
        data.prev = prev || false;
        data.next = next || false;

        this.dataHandler.setEpisodeData(this.url.pathname, data);
    }

    play() {
        // setTimeout needed because loading time of js libs
        setTimeout(() => {
            let playerElem = document.querySelector('section.serie .hoster-player');
            if(playerElem) {
                let clickEvent = new Event('click');
                clickEvent.which = 1;
                clickEvent.pageX = 1;
                clickEvent.pageY = 1;
                playerElem.dispatchEvent(clickEvent);
                waitForElem('.hoster-player a').then((elem) => {
                    let data = this.dataHandler.getEpisodeData(this.url.pathname) || {};
                    let url = elem.href;
                    data.vivourl = url;
                    this.settings.lastVivoUrl = url;
                    this.settings.lastBsUrl = this.url.pathname;
                    this.settings.lastName = document.querySelector('section.serie h2').innerText;
                    this.dataHandler.setSettings(this.settings);
                    this.dataHandler.setEpisodeData(this.url.pathname, data);
                    window.close();
                })
            }
        }, 1000);
    }

    addProgessBars() {
        let elements = document.querySelectorAll('.episodes tr');
        elements.forEach((episodeRowElem) => {
            let url = new URL(episodeRowElem.querySelector('a').href);
            let path = url.pathname;
            let data = this.dataHandler.getEpisodeData(path) || this.dataHandler.getEpisodeData(path + '/Vivo/');
            let percentage = data.currentTime * 100 / data.maxTime;

            if (percentage) {
                let episodeProgressbarElem = document.createElement("meter");
                episodeProgressbarElem.value = percentage;
                episodeProgressbarElem.max = 100;
                episodeProgressbarElem.style.width = "100%";
                episodeRowElem.appendChild(episodeProgressbarElem);
            }
        });
    }

    main() {
        this.loadAutoplayButtons();
        this.addProgessBars();
        if(window.location.hash.substr(1) == 'autoplay') {
            this.setPrevAndNextEpisode();
            this.play();
        }
    }

}

class DataHandler {
    constructor() {
    }

    setSettings(data) {
        try {
            let d = JSON.stringify(data);
            GM_setValue('settings', d);
        } catch(e) {

            return false;
        }

        return true;
    }

    getSettings() {
        let data = GM_getValue('settings') || '{}';

        try {
            data = JSON.parse(data);
        } catch(e) {

            return false;
        }
        return data;
    }

    setEpisodeData(url, data) {
        try {
            let d = JSON.stringify(data);
            GM_setValue(url, d);
        } catch(e) {

            return false;
        }

        return true;
    }

    getEpisodeData(url) {
        let data = GM_getValue(url) || {};


        try {
            data = JSON.parse(data);
        } catch(e) {

            return false;
        }
        return data;
    }
}

class AnimeFillerHandler extends SiteHandler {
    constructor() {
        super();
        this.manualMapping = {
            'Steins-Gate': 'steinsgate',
            'Dragonball': 'dragon-ball',
            'Dragonball-GT': 'Dragon-Ball-GT',
            'Dragonball-Super': 'Dragon-Ball-Super',
            'Dragonball-Z': 'Dragon-Ball-Z',
            'Dragonball-Z-Kai': 'Dragon-Ball-Z-Kai',
            'Hunter-x-Hunter': 'hunter-x-hunter-1999',
            'Hunter-x-Hunter-2011': 'hunter-x-hunter',
            'Detektiv-Conan': 'detective-conan',
            'Assassination-Classroom': 'ansatsu-kyoushitsu-assassination-classroom',
            'Nanatsu-no-Taizai-The-Seven-Deadly-Sins': 'nanatsu-no-taizai',
            'Sword-Art-Online-Alternative-Gun-Gale-Online': 'sword-art-online-alternative-ggo',
            'Shingeki-no-Kyojin-Attack-on-Titan': 'attack-titan',
            'Boku-no-Hero-Academia-My-Hero-Academia': 'my-hero-academia'
        }
        if(this.settings.fillerEnabled) {
            // TODO
        }
        this.loadButton();
        this.markFillerEpisodes();
    }

    markFillerEpisodes() {
        let episodeRows = document.querySelectorAll('.episodes tr');
        episodeRows.forEach((episode) => {
            let url = new URL(episode.querySelector('a').href);
            let path = url.pathname;
            let data = this.dataHandler.getEpisodeData(path);
            if(data.isFiller) {
                episode.style.setProperty("background-color", "red", "important");
            }
        });
    }

    async getFiller() {
        let name = this.getName();
        let data = await this.getReq("https://www.animefillerlist.com/shows/" + name)
        return new Promise((resolve, reject) => {
            data = this.extractFillerEpisode(data);
            resolve(data);
        });
    }

    extractFillerEpisode(dom) {
        let extracted = [];
        let fillerEpisodes = dom.querySelector('div.filler > .Episodes').innerText;
        fillerEpisodes = fillerEpisodes.split(',');
        fillerEpisodes.forEach((episode) => {
            let e = episode.split('-');
            if (e.length > 1) {

                let from = e[0];
                let to = e[1];
                for(let i = from; i <= to; i++) {
                    extracted.push(i);
                }
            } else {
                extracted.push(e[0]);
            }
        })

        return extracted;
    }

    getName() {
        let url = new URL(window.location.href);
        let path = url.pathname.split('/');
        return this.manualMapping[path[2]] ?? path[2]
    }

    async getReq(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    let parser = new DOMParser();
                    let doc = parser.parseFromString(response.responseText, "text/html");
                    resolve(doc);
                }
            });
        });
    }

    saveFiller(filler, doc = document, last = 0) {
        let episodes = doc.querySelectorAll('.episodes tr');
        let lastEpisode = last + episodes.length;
        filler.forEach((fillerNum) => {
            let episode = episodes[fillerNum - 1 - last];
            if(episode) {
                let url = new URL(episode.querySelector('a').href);
                let path = url.pathname;
                let data = this.dataHandler.getEpisodeData(path) || {};
                data.isFiller = true;
                this.dataHandler.setEpisodeData(path, data);
            }
        });
        return lastEpisode;
    }

    async sync() {
        let filler = await this.getFiller();
        let seasons = document.querySelectorAll('#seasons li a')
        let last = 0;
        let counter = 0;
        for(let i = 0; i < seasons.length; i++) {
            if(seasons[i].innerText == "Specials") {
                continue;
            }
            let doc = await this.getReq(seasons[i].href);
            last = this.saveFiller(filler, doc, last);
        }
        return;
    }

    async fillerExists() {
        let name = this.getName();
        let doc = await this.getReq("https://www.animefillerlist.com/shows/" + name);
        if(doc.querySelector('div.filler > .Episodes')) {
            return true;
        }
        return false;
    }

    async loadButton() {
        if(!await this.fillerExists()) {
            return;
        }
        let button = document.createElement('button');
        button.innerText = 'Filler Laden';
        button.style.backgroundColor = 'orange';
        button.style.padding = '5px';
        button.style.border = '2px solid black';
        button.style.fontWeight = 'bold';
        button.style.fontSize = "15px";
        button.addEventListener('click', async () => {
            button.innerText = 'loading ...';
            try {
                await this.sync();
                new Notify({
                    text: 'Erfolgreich geladen',
                    type: 'success',
                    timeout: 3000
                }).show();
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } catch {
                new Notify({
                    text: 'Konnte nichts für diese Serie finden :(',
                    type: 'error',
                    timeout: 3000
                }).show();
            }

        });
        let target = await waitForElem('.seasons');
        target.prepend(button);
    }
}

new BsHandler();
new VivoHandler();
new AnimeFillerHandler();
