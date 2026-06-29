/**
 * DOM Patcher (DOM Diffing Utility)
 * Parchea el DOM de manera eficiente comparando nodos para evitar parpadeos visuales
 */
window.updateDOM = function(target, newHTML) {
    if (!target) return;
    
    // Parsear el nuevo HTML a una estructura de nodos
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${newHTML}</div>`, 'text/html');
    const newRoot = doc.body.firstChild;
    
    // Iniciar comparación recursiva
    diffNodes(target, newRoot);
};

function diffNodes(oldNode, newNode) {
    const oldChildren = Array.from(oldNode.childNodes);
    const newChildren = Array.from(newNode.childNodes);
    
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
        const oChild = oldChildren[i];
        const nChild = newChildren[i];
        
        // 1. Nodo nuevo: agregar al final
        if (!oChild && nChild) {
            oldNode.appendChild(nChild.cloneNode(true));
            continue;
        }
        
        // 2. Nodo removido: quitar del DOM
        if (oChild && !nChild) {
            oldNode.removeChild(oChild);
            continue;
        }
        
        // 3. Nodos de distinto tipo o etiqueta: reemplazar completo
        if (oChild.nodeType !== nChild.nodeType || oChild.nodeName !== nChild.nodeName) {
            oChild.replaceWith(nChild.cloneNode(true));
            continue;
        }
        
        // 4. Si es un nodo de texto: actualizar si el contenido es diferente
        if (oChild.nodeType === Node.TEXT_NODE) {
            if (oChild.textContent !== nChild.textContent) {
                oChild.textContent = nChild.textContent;
            }
            continue;
        }
        
        // 5. Si es un elemento: sincronizar atributos, inputs y descendientes
        if (oChild.nodeType === Node.ELEMENT_NODE) {
            // Sincronizar atributos viejos (remover si ya no existen)
            Array.from(oChild.attributes).forEach(attr => {
                if (!nChild.hasAttribute(attr.name)) {
                    oChild.removeAttribute(attr.name);
                }
            });
            
            // Sincronizar atributos nuevos/modificados
            Array.from(nChild.attributes).forEach(attr => {
                if (oChild.getAttribute(attr.name) !== attr.value) {
                    oChild.setAttribute(attr.name, attr.value);
                }
            });
            
            // Preservar valor de campos interactivos (input, textarea, select)
            if ('value' in oChild && oChild.value !== nChild.value) {
                oChild.value = nChild.value;
            }
            
            // Especial para acordeones <details> para no cerrar lo que el usuario expandió
            if (oChild.tagName === 'DETAILS') {
                if (oChild.open) {
                    nChild.setAttribute('open', '');
                } else {
                    nChild.removeAttribute('open');
                }
            }
            
            // Comparación recursiva de hijos
            diffNodes(oChild, nChild);
        }
    }
}
