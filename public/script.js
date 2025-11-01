function change(val){
var x=document.getElementById("t_"+val);
var y=document.getElementById("c_"+val);
if(y.checked)
{
x.disabled=false;
x.min=1;
x.value=1;
}
else{
x.min=0;
x.value=0;
x.disabled=true;
}
}