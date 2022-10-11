// ==UserScript==
// @name         s.to autoplay
// @namespace    https://github.com/zaheer-exe
// @version      6
// @description  Autoplay für SerienStream.to
// @author       zaheer-exe
// @match        https://s.to/*
// @match        https://serienstream.to/*
// @match        https://aniworld.to/*
// @match        https://voe.sx/*
// @match        https://vidoza.net/*
// @grant        GM_xmlhttpRequest
// @icon         https://www.google.com/s2/favicons?sz=64&domain=s.to
// @license      Apache License
// @grant        none
// ==/UserScript==
 
(async () => {
    const sToHosts = ['s.to', 'aniworld.to', 'serienstream.to'];
    const supportedHosterHosts = ['voe.sx', 'streamtape.com', 'vidoza.net'];
    const currentHost = (() => {
        const url = new URL(document.location);
        return url.host;
    })();
 
    // code by  https://stackoverflow.com/a/61511955/14589345
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
 
    // s.to
    if (sToHosts.includes(currentHost)) {
        console.log('running for ' + currentHost);
 
        waitForElem('.seasonEpisodeTitle').then(() => {
            const watchData = JSON.parse((localStorage.getItem('watchData') ?? '{}'));
            function addProgressBar(elem) {
                const episodeUrl = new URL(elem.querySelector('a').href);
                console.log(episodeUrl)
                if (Object.keys(watchData).includes(episodeUrl.href)) {
                    elem.style = 'position: relative; z-index: 5;';
                    const watchDataForEpisode = watchData[episodeUrl.href];
                    const progressBarElem = document.createElement('progress');
                    progressBarElem.value = watchDataForEpisode.currentTime;
                    progressBarElem.max = watchDataForEpisode.duration;
                    progressBarElem.style = 'position: absolute; width: 100%; height: 100%; appearance: none; top: 0; z-index: -1; opacity: 0.5;';
                    elem.appendChild(progressBarElem);
                }
            }
            const allElements = document.querySelectorAll('.seasonEpisodeTitle');
            allElements.forEach(addProgressBar)
        });
 
        const iframe = await waitForElem('.inSiteWebStream iframe[src]');
        console.log(iframe)
        iframe.allow="autoplay; fullscreen; picture-in-picture; xr-spatial-tracking; clipboard-write";
        if (iframe.src.includes('redirect')) {
            localStorage.setItem('iframeUrl', iframe.src);
            localStorage.setItem('episodeDescription', document.querySelector('.hosterSiteTitle').innerHTML);
        }
 
        addEventListener('storage', async (event) => {
            if (event.key == 'iframeUrl') {
                iframe.src = event.newValue;
            }
            if (event.key == 'episodeDescription') {
                document.querySelector('.hosterSiteTitle').innerHTML = event.newValue;
            }
        });
 
        window.addEventListener('message', (event) => {
            const sourceUrl = new URL(event.origin);
            if (supportedHosterHosts.includes(sourceUrl.host)) {
                const data = JSON.parse(event.data);
                let watchData = JSON.parse((localStorage.getItem('watchData') ?? '{}'));
                watchData[window.location] = data;
                localStorage.setItem('watchData', JSON.stringify(watchData));
                if (iframe.src.includes('redirect')) {
                    iframe.src = data.url;
                }
                if (data.duration > 0 && data.duration == data.currentTime) {
                    const episodeMenuCurrentELem = document.querySelector('li a.active[href*="episode"]');
                    episodeMenuCurrentELem.classList.remove('active');
                    const nextEpisodeUrl = episodeMenuCurrentELem.parentElement.nextElementSibling.querySelector('a');
                    nextEpisodeUrl.classList.add('active');
                    window.history.pushState("", "", nextEpisodeUrl.href);
                    iframe.src = nextEpisodeUrl.href;
                }
            }
        }, false);
    }
 
    // video hosters
    if (supportedHosterHosts.includes(currentHost)) {
        console.log('running for ' + currentHost);
        const video = await waitForElem('video');
        video.setAttribute('autoplay', '');
        video.play();
        const lastTime = JSON.parse((localStorage.getItem('lastTime') ?? '{}'));
        const videoData = {
            url: window.location.href,
            duration: video.duration,
            currentTime: 0
        }
        window.parent.postMessage(JSON.stringify(videoData), '*');
        video.addEventListener('loadeddata', (event) => {
            if (Object.keys(lastTime).includes(window.location.href)) {
                waitForElem('.plyr__progress').then(elem => {
                    const progressBarElem = document.createElement('progress');
                    progressBarElem.value = lastTime[window.location];
                    progressBarElem.max = video.duration;
                    progressBarElem.style = 'color: green;';
                    progressBarElem.classList.add('plyr__progress__buffer');
                    elem.appendChild(progressBarElem);
                });
            }
        });
        video.addEventListener('progress', (event) => {
            videoData.currentTime = video.currentTime;
            videoData.duration = video.duration;
            window.parent.postMessage(JSON.stringify(videoData), '*');
            lastTime[window.location.href] = videoData.currentTime;
            localStorage.setItem('lastTime', JSON.stringify(lastTime));
        });
        video.addEventListener('ended', (event) => {
            videoData.currentTime = video.currentTime;
            videoData.duration = video.duration;
            window.parent.postMessage(JSON.stringify(videoData), '*');
        });
    }
 
})()
