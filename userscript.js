// ==UserScript==
// @name         s.to autoplay
// @namespace    https://github.com/zaheer-exe
// @version      6.2
// @description  Autoplay für SerienStream.to
// @author       zaheer-exe
// @match        https://s.to/*
// @match        https://serienstream.to/*
// @match        https://aniworld.to/*
// @match        https://voe.sx/*
// @match        https://vidoza.net/*
// @match         https://jayservicestuff.com/*
// @grant        GM_xmlhttpRequest
// @icon         https://www.google.com/s2/favicons?sz=64&domain=s.to
// @license      Apache License
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/400669/sto%20autoplay.user.js
// @updateURL https://update.greasyfork.org/scripts/400669/sto%20autoplay.meta.js
// ==/UserScript==

function getNextEpisodeUrl(target)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", target, false ); // false for synchronous requesy
    xmlHttp.send(null);
    let temp = document.createElement('div')
    temp.innerHTML=xmlHttp.responseText;
    console.log(xmlHttp.responseText)
    let tempElem = temp.querySelector('.watchEpisode .icon.VOE')
    console.log(tempElem)
    let url = tempElem.parentElement.href
    return url;
}

(async () => {
    const sToHosts = ['s.to', 'aniworld.to', 'serienstream.to'];
    const supportedHosterHosts = ['voe.sx', 'streamtape.com', 'vidoza.net', 'jayservicestuff.com'];
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

        function nextEpisode() {
            const episodeMenuCurrentELem = document.querySelector('li a.active[href*="episode"]');
            episodeMenuCurrentELem.classList.remove('active');
            const nextEpisodeUrl = episodeMenuCurrentELem.parentElement.nextElementSibling.querySelector('a');
            if (nextEpisodeUrl) {
                nextEpisodeUrl.classList.add('active');
                window.history.pushState("", "", nextEpisodeUrl.href);
                console.log(iframe);
                let url = getNextEpisodeUrl(nextEpisodeUrl.href);
                iframe.src = url;
            }
        }

        function prevEpisode() {
            const episodeMenuCurrentELem = document.querySelector('li a.active[href*="episode"]');
            const prevEpisodeUrl = episodeMenuCurrentELem.parentElement.previousElementSibling.querySelector('a');
            if (prevEpisodeUrl) {
                episodeMenuCurrentELem.classList.remove('active');
                prevEpisodeUrl.classList.add('active');
                window.history.pushState("", "", prevEpisodeUrl.href);
                iframe.src = prevEpisodeUrl.href;
            }
        }

        waitForElem('.seasonEpisodeTitle').then(() => {
            const watchData = JSON.parse((localStorage.getItem('watchData') ?? '{}'));
            function addProgressBar(elem) {
                const episodeUrl = new URL(elem.querySelector('a').href);
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
                if (data.type == 'watchData') {
                    let watchData = JSON.parse((localStorage.getItem('watchData') ?? '{}'));
                    watchData[window.location] = data;
                    localStorage.setItem('watchData', JSON.stringify(watchData));
                    if (iframe.src.includes('redirect')) {
                        console.log(data.url);
                        iframe.src = data.url;
                    }
                    if (data.duration > 0 && data.duration == data.currentTime) {
                        nextEpisode();
                    }
                }
                if (data.type == 'action') {
                    if (data.action == 'next') {
                        nextEpisode();
                    }
                    if (data.action == 'prev') {
                        prevEpisode();
                    }
                }
            }
        }, false);
    }

    // video hosters
    if (supportedHosterHosts.includes(currentHost)) {
        console.log('running for ' + currentHost);
        const overlay = await waitForElem('.voe-play.play-centered')
        overlay.click();
        const video = await waitForElem('video');
        video.setAttribute('autoplay', '');
        video.play();
        const lastTime = JSON.parse((localStorage.getItem('lastTime') ?? '{}'));
        const videoData = {
            url: window.location.href,
            duration: video.duration,
            currentTime: 0,
            type: 'watchData'
        }
        window.parent.postMessage(JSON.stringify(videoData), '*');
        video.addEventListener('loadeddata', (event) => {
            if (Object.keys(lastTime).includes(window.location.href)) {
                // OLD
                waitForElem('.vds-slider-chapter').then(elem => {
                    const progressBarElem = document.createElement('progress');
                    progressBarElem.value = lastTime[window.location];
                    progressBarElem.max = video.duration;
                    progressBarElem.style = 'color: green;';
                    progressBarElem.classList.add('vds-slider-track');
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

        waitForElem('media-controls-group').then((elem) => {
            let buttonElemNext = document.createElement('span');
            buttonElemNext.style.position = 'absolute';
            buttonElemNext.style.top = '-75px';
            buttonElemNext.style.left = 'unset';
            buttonElemNext.style.zIndex = '999';
            buttonElemNext.style.right = '0';
            buttonElemNext.innerHTML = `
            <svg style="width:70px;height:70px" viewBox="0 0 24 24">
                <path fill="white" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
             </svg>
            `;
            elem.appendChild(buttonElemNext);
            let buttonElemPrev = buttonElemNext.cloneNode(true);
            buttonElemPrev.style.left = '0';
            buttonElemPrev.style.right = 'unset';
            buttonElemPrev.style.transform = 'rotate(180deg)';
            elem.appendChild(buttonElemPrev);
            buttonElemNext.addEventListener('click', () => {
                window.parent.postMessage(JSON.stringify({type: 'action', action: 'next'}), '*');
            });
            buttonElemPrev.addEventListener('click', () => {
                window.parent.postMessage(JSON.stringify({type: 'action', action: 'prev'}), '*');
            });
        });
    }

})()
