// IDs are public configuration. No personal details are sent in analytics events.
let config={},gaLoaded=false,pixelLoaded=false;
function preferences(){try{return JSON.parse(localStorage.getItem('morada-consent')||'{}');}catch{return {};}}
function addScript(src,id){if(document.getElementById(id))return;const script=document.createElement('script');script.async=true;script.src=src;script.id=id;document.head.append(script);}
function applyMeasurement(){
 const consent=preferences();
 if(consent.analytics===true&&/^G-[A-Z0-9]{4,20}$/.test(config.ga4||'')&&!gaLoaded){
   window.dataLayer=window.dataLayer||[];
   window.gtag=function(){window.dataLayer.push(arguments);};
   window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   window.gtag('js',new Date());window.gtag('config',config.ga4,{send_page_view:true});
   addScript('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(config.ga4),'morada-ga4');gaLoaded=true;
 }
 if(consent.marketing===true&&/^\d{5,25}$/.test(config.pixel||'')&&!pixelLoaded){
   const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments);};
   fbq.queue=[];fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;window._fbq=fbq;
   fbq('consent','grant');fbq('init',config.pixel);fbq('track','PageView');
   addScript('https://connect.facebook.net/en_US/fbevents.js','morada-meta');pixelLoaded=true;
 }
}
fetch('/api/config').then(r=>r.ok?r.json():{}).then(data=>{config=data.config||{};applyMeasurement();}).catch(()=>{});
window.addEventListener('morada:consent',()=>{
 const consent=preferences();
 if(!consent.analytics&&window.gtag)window.gtag('consent','update',{analytics_storage:'denied'});
 if(!consent.marketing&&window.fbq)window.fbq('consent','revoke');
 if((gaLoaded&&!consent.analytics)||(pixelLoaded&&!consent.marketing)){location.reload();return;}
 applyMeasurement();
});
window.addEventListener('morada:lead',event=>{
 const consent=preferences(),detail=event.detail||{};
 if(consent.analytics&&gaLoaded)window.gtag('event','generate_lead',{currency:detail.currency});
 if(consent.marketing&&pixelLoaded)window.fbq('track','Lead',{currency:detail.currency});
});
