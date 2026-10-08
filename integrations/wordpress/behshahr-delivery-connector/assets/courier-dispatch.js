(function () {
  'use strict';
  function request(action, orderId, nonce, courierId) {
    var body = new URLSearchParams({action:action,order_id:orderId,nonce:nonce});
    if (courierId) body.set('courier_id', courierId);
    return fetch(BHDDeliveryDispatch.ajaxUrl, {
      method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
      body:body.toString(),
    }).then(function(response) {
      return response.json().catch(function () { throw new Error('پاسخ سرور معتبر نیست.'); })
        .then(function(data) {
          if (!response.ok || !data.success) {
            throw new Error((data.data && data.data.message) || 'ارتباط با سرور ناموفق بود.');
          }
          return data.data;
        });
    });
  }
  function init(root) {
    var id=root.dataset.orderId, nonce=root.dataset.nonce;
    var select=root.querySelector('.bhd-dispatch-select');
    var status=root.querySelector('.bhd-dispatch-status');
    var notice=root.querySelector('.bhd-dispatch-notice');
    var submit=root.querySelector('.bhd-dispatch-submit');
    var refresh=root.querySelector('.bhd-dispatch-refresh');
    var loading=false;

    function setNotice(text, error) {
      notice.textContent=text;
      notice.style.color=error ? '#b32d2e' : '#167147';
    }
    function load() {
      select.disabled=true; submit.disabled=true;
      status.textContent='در حال دریافت وضعیت رانندگان…';
      setNotice('',false);
      request('bhd_delivery_couriers',id,nonce).then(function(data) {
        var assignment=data.assignment || {linked:false};
        var linked=Boolean(assignment.linked);
        status.textContent=linked
          ? 'سفارش '+(assignment.publicCode||'')+' • '+assignment.status+
              (assignment.courierName ? ' • راننده: '+assignment.courierName : '')
          : 'سفارش هنوز در سامانه ارسال ثبت نشده؛ هنگام تخصیص ثبت می‌شود.';
        select.replaceChildren();
        var opt=document.createElement('option');
        opt.value=''; opt.textContent='انتخاب راننده آماده';
        select.appendChild(opt);
        var eligible=0;
        (data.couriers||[]).forEach(function(c) {
          if (c.vehicleType !== data.vehicleType) return;
          var option=document.createElement('option');
          option.value=c.id;
          option.textContent=(c.fullName||c.phone)+' ('+(c.vehicleType==='CAR'?'خودرو':'موتور')+') • '+
            (c.status==='AVAILABLE'?'آماده':c.status==='BUSY'?'مشغول':c.status==='OFFLINE'?'آفلاین':'تعلیق');
          option.disabled=c.status!=='AVAILABLE';
          if (!option.disabled) eligible++;
          select.appendChild(option);
        });
        var allowed=!linked || ['REQUESTED','ASSIGNED'].includes(assignment.status);
        if (!allowed) {
          setNotice('این سفارش در وضعیت فعلی قابل تخصیص یا جابه‌جایی نیست.',true);
        } else if (!eligible) {
          setNotice('راننده آماده با وسیله موردنیاز وجود ندارد.',true);
        }
        select.disabled=!allowed || !eligible;
        submit.textContent=linked && assignment.status==='ASSIGNED'
          ? 'انتقال سفارش به راننده دیگر' : 'ارسال سفارش به راننده';
        submit.disabled=true;
      }).catch(function(e) {
        status.textContent='خطا در دریافت وضعیت ارسال';
        setNotice(e.message||'خطای اتصال',true);
      });
    }
    select.addEventListener('change',function () { submit.disabled=!select.value || loading; });
    refresh.addEventListener('click',function() { if(!loading) load(); });
    submit.addEventListener('click',function () {
      if(!select.value || loading) return;
      if(!window.confirm('سفارش برای راننده انتخاب‌شده ارسال شود؟')) return;
      loading=true; select.disabled=true; submit.disabled=true;
      setNotice('در حال ارسال سفارش و تخصیص راننده…',false);
      request('bhd_delivery_assign_courier',id,nonce,select.value)
        .then(function(data) { setNotice(data.message||'تخصیص موفق',false); load(); })
        .catch(function(e) { setNotice(e.message||'تخصیص ناموفق بود.',true); })
        .finally(function() {loading=false;});
    });
    load();
  }
  document.addEventListener('DOMContentLoaded',function() {
    document.querySelectorAll('.bhd-courier-dispatch').forEach(init);
  });
})();