
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "actividad_empleado": {
                  Row: {
                    "actividad_preventiva_id": string,"activo": boolean,"actualizado_en": string,"creado_en": string,"creado_por": string | null,"empleado_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_preventiva_id": string,"activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"empleado_id": string,"id"?: string
                  }
                  Update: {
                    "actividad_preventiva_id"?: string,"activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"empleado_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "actividad_empleado_actividad_preventiva_id_fkey"
      columns: ["actividad_preventiva_id"]
isOneToOne: false
      referencedRelation: "actividad_preventiva"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actividad_empleado_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actividad_empleado_empleado_id_fkey"
      columns: ["empleado_id"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    }
                  ]
                },"actividad_preventiva": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"asentamiento_id": number | null,"creado_en": string,"creado_por": string | null,"direccion": string | null,"id": string,"nivel_educativo": Database["public"]['Enums']["nivel_educativo"] | null,"numero_asistentes": number | null,"programada_en": string,"referencias": string | null,"sede": string,"tipo_actividad_id": number,"tipo_institucion": Database["public"]['Enums']["tipo_institucion_actividad"],"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"creado_en"?: string,"creado_por"?: string | null,"direccion"?: string | null,"id"?: string,"nivel_educativo"?: Database["public"]['Enums']["nivel_educativo"] | null,"numero_asistentes"?: number | null,"programada_en": string,"referencias"?: string | null,"sede": string,"tipo_actividad_id": number,"tipo_institucion": Database["public"]['Enums']["tipo_institucion_actividad"],"titulo": string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"creado_en"?: string,"creado_por"?: string | null,"direccion"?: string | null,"id"?: string,"nivel_educativo"?: Database["public"]['Enums']["nivel_educativo"] | null,"numero_asistentes"?: number | null,"programada_en"?: string,"referencias"?: string | null,"sede"?: string,"tipo_actividad_id"?: number,"tipo_institucion"?: Database["public"]['Enums']["tipo_institucion_actividad"],"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "actividad_preventiva_asentamiento_id_fkey"
      columns: ["asentamiento_id"]
isOneToOne: false
      referencedRelation: "cat_asentamiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actividad_preventiva_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actividad_preventiva_tipo_actividad_id_fkey"
      columns: ["tipo_actividad_id"]
isOneToOne: false
      referencedRelation: "cat_tipo_actividad"
      referencedColumns: ["id"]
    }
                  ]
                },"agresor": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"apellido_materno": string | null,"apellido_paterno": string | null,"asentamiento_id": number | null,"calle": string | null,"codigo_postal": string | null,"creado_en": string,"creado_por": string | null,"curp": string | null,"drogas": (Database["public"]['Enums']["tipo_droga"])[] | null,"edad": number | null,"entidad_nacimiento": string | null,"especificacion_arma": string | null,"especificacion_droga": string | null,"estado_civil": Database["public"]['Enums']["estado_civil"] | null,"fecha_nacimiento": string | null,"ficha_id": string,"id": string,"nombres": string,"numero_exterior": string | null,"numero_interior": string | null,"observaciones": string | null,"ocupacion_id": number | null,"ocupacion_otra": string | null,"parentesco_id": number | null,"parentesco_otro": string | null,"referencias": string | null,"sexo": Database["public"]['Enums']["sexo_biologico"] | null,"tiene_consumo_alcohol": boolean | null,"tiene_consumo_droga": boolean | null,"tipo_trabajo": Database["public"]['Enums']["tipo_trabajo"] | null,"zona": Database["public"]['Enums']["zona_geografica"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"apellido_materno"?: string | null,"apellido_paterno"?: string | null,"asentamiento_id"?: number | null,"calle"?: string | null,"codigo_postal"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"curp"?: string | null,"drogas"?: (Database["public"]['Enums']["tipo_droga"])[] | null,"edad"?: number | null,"entidad_nacimiento"?: string | null,"especificacion_arma"?: string | null,"especificacion_droga"?: string | null,"estado_civil"?: Database["public"]['Enums']["estado_civil"] | null,"fecha_nacimiento"?: string | null,"ficha_id": string,"id"?: string,"nombres": string,"numero_exterior"?: string | null,"numero_interior"?: string | null,"observaciones"?: string | null,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"parentesco_id"?: number | null,"parentesco_otro"?: string | null,"referencias"?: string | null,"sexo"?: Database["public"]['Enums']["sexo_biologico"] | null,"tiene_consumo_alcohol"?: boolean | null,"tiene_consumo_droga"?: boolean | null,"tipo_trabajo"?: Database["public"]['Enums']["tipo_trabajo"] | null,"zona"?: Database["public"]['Enums']["zona_geografica"] | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"apellido_materno"?: string | null,"apellido_paterno"?: string | null,"asentamiento_id"?: number | null,"calle"?: string | null,"codigo_postal"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"curp"?: string | null,"drogas"?: (Database["public"]['Enums']["tipo_droga"])[] | null,"edad"?: number | null,"entidad_nacimiento"?: string | null,"especificacion_arma"?: string | null,"especificacion_droga"?: string | null,"estado_civil"?: Database["public"]['Enums']["estado_civil"] | null,"fecha_nacimiento"?: string | null,"ficha_id"?: string,"id"?: string,"nombres"?: string,"numero_exterior"?: string | null,"numero_interior"?: string | null,"observaciones"?: string | null,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"parentesco_id"?: number | null,"parentesco_otro"?: string | null,"referencias"?: string | null,"sexo"?: Database["public"]['Enums']["sexo_biologico"] | null,"tiene_consumo_alcohol"?: boolean | null,"tiene_consumo_droga"?: boolean | null,"tipo_trabajo"?: Database["public"]['Enums']["tipo_trabajo"] | null,"zona"?: Database["public"]['Enums']["zona_geografica"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agresor_asentamiento_id_fkey"
      columns: ["asentamiento_id"]
isOneToOne: false
      referencedRelation: "cat_asentamiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agresor_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agresor_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agresor_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    },{
      foreignKeyName: "agresor_ocupacion_id_fkey"
      columns: ["ocupacion_id"]
isOneToOne: false
      referencedRelation: "cat_ocupacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agresor_parentesco_id_fkey"
      columns: ["parentesco_id"]
isOneToOne: false
      referencedRelation: "cat_parentesco"
      referencedColumns: ["id"]
    }
                  ]
                },"alerta": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"asentamiento_id": number | null,"atendida_en": string | null,"atendida_por": string | null,"creado_en": string,"creado_por": string | null,"estado": Database["public"]['Enums']["estado_alerta"],"id": string,"observaciones": string | null,"origen": Database["public"]['Enums']["origen_alerta"],"persona_id": string | null,"pre_registro_id": string | null,"prioridad": Database["public"]['Enums']["prioridad_nivel"],"tomada_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"atendida_en"?: string | null,"atendida_por"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"estado"?: Database["public"]['Enums']["estado_alerta"],"id"?: string,"observaciones"?: string | null,"origen": Database["public"]['Enums']["origen_alerta"],"persona_id"?: string | null,"pre_registro_id"?: string | null,"prioridad"?: Database["public"]['Enums']["prioridad_nivel"],"tomada_en"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"atendida_en"?: string | null,"atendida_por"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"estado"?: Database["public"]['Enums']["estado_alerta"],"id"?: string,"observaciones"?: string | null,"origen"?: Database["public"]['Enums']["origen_alerta"],"persona_id"?: string | null,"pre_registro_id"?: string | null,"prioridad"?: Database["public"]['Enums']["prioridad_nivel"],"tomada_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerta_asentamiento_id_fkey"
      columns: ["asentamiento_id"]
isOneToOne: false
      referencedRelation: "cat_asentamiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerta_atendida_por_fkey"
      columns: ["atendida_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerta_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerta_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "persona"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerta_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["persona_id"]
    },{
      foreignKeyName: "alerta_pre_registro_id_fkey"
      columns: ["pre_registro_id"]
isOneToOne: false
      referencedRelation: "pre_registro"
      referencedColumns: ["id"]
    }
                  ]
                },"aportante_hogar": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"creado_en": string,"creado_por": string | null,"estudio_socioeconomico_id": string,"frecuencia": Database["public"]['Enums']["frecuencia_ingreso"] | null,"id": string,"monto": number | null,"nombre": string,"ocupacion_id": number | null,"ocupacion_otra": string | null,"parentesco_id": number | null,"parentesco_otro": string | null,"tipo_trabajo": Database["public"]['Enums']["tipo_trabajo"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"estudio_socioeconomico_id": string,"frecuencia"?: Database["public"]['Enums']["frecuencia_ingreso"] | null,"id"?: string,"monto"?: number | null,"nombre": string,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"parentesco_id"?: number | null,"parentesco_otro"?: string | null,"tipo_trabajo"?: Database["public"]['Enums']["tipo_trabajo"] | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"estudio_socioeconomico_id"?: string,"frecuencia"?: Database["public"]['Enums']["frecuencia_ingreso"] | null,"id"?: string,"monto"?: number | null,"nombre"?: string,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"parentesco_id"?: number | null,"parentesco_otro"?: string | null,"tipo_trabajo"?: Database["public"]['Enums']["tipo_trabajo"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "aportante_hogar_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aportante_hogar_estudio_socioeconomico_id_fkey"
      columns: ["estudio_socioeconomico_id"]
isOneToOne: false
      referencedRelation: "estudio_socioeconomico"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aportante_hogar_ocupacion_id_fkey"
      columns: ["ocupacion_id"]
isOneToOne: false
      referencedRelation: "cat_ocupacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aportante_hogar_parentesco_id_fkey"
      columns: ["parentesco_id"]
isOneToOne: false
      referencedRelation: "cat_parentesco"
      referencedColumns: ["id"]
    }
                  ]
                },"atencion": {
                  Row: {
                    "acciones_realizadas": string | null,"activo": boolean,"actualizado_en": string,"area_id": number,"atendida_en": string,"atendida_por": string | null,"celular": string | null,"cita_id": string | null,"creado_en": string,"creado_por": string | null,"domicilio_id": string | null,"estado_civil": Database["public"]['Enums']["estado_civil"] | null,"ficha_id": string,"id": string,"observaciones": string | null,"ocupacion_id": number | null,"ocupacion_otra": string | null,"prioridad": Database["public"]['Enums']["prioridad_nivel"] | null,"proxima_accion": string | null,"tipo_atencion_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "acciones_realizadas"?: string | null,"activo"?: boolean,"actualizado_en"?: string,"area_id": number,"atendida_en"?: string,"atendida_por"?: string | null,"celular"?: string | null,"cita_id"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"domicilio_id"?: string | null,"estado_civil"?: Database["public"]['Enums']["estado_civil"] | null,"ficha_id": string,"id"?: string,"observaciones"?: string | null,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"prioridad"?: Database["public"]['Enums']["prioridad_nivel"] | null,"proxima_accion"?: string | null,"tipo_atencion_id": number
                  }
                  Update: {
                    "acciones_realizadas"?: string | null,"activo"?: boolean,"actualizado_en"?: string,"area_id"?: number,"atendida_en"?: string,"atendida_por"?: string | null,"celular"?: string | null,"cita_id"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"domicilio_id"?: string | null,"estado_civil"?: Database["public"]['Enums']["estado_civil"] | null,"ficha_id"?: string,"id"?: string,"observaciones"?: string | null,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"prioridad"?: Database["public"]['Enums']["prioridad_nivel"] | null,"proxima_accion"?: string | null,"tipo_atencion_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "atencion_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_atendida_por_fkey"
      columns: ["atendida_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_cita_id_fkey"
      columns: ["cita_id"]
isOneToOne: true
      referencedRelation: "cita"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_domicilio_id_fkey"
      columns: ["domicilio_id"]
isOneToOne: false
      referencedRelation: "domicilio"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    },{
      foreignKeyName: "atencion_ocupacion_id_fkey"
      columns: ["ocupacion_id"]
isOneToOne: false
      referencedRelation: "cat_ocupacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "atencion_tipo_atencion_id_area_id_fkey"
      columns: ["tipo_atencion_id","area_id"]
isOneToOne: false
      referencedRelation: "cat_tipo_atencion"
      referencedColumns: ["id","area_id"]
    },{
      foreignKeyName: "atencion_tipo_atencion_id_fkey"
      columns: ["tipo_atencion_id"]
isOneToOne: false
      referencedRelation: "cat_tipo_atencion"
      referencedColumns: ["id"]
    }
                  ]
                },"bitacora_acceso": {
                  Row: {
                    "accion": Database["public"]['Enums']["accion_bitacora"],"creado_en": string,"empleado_id": string | null,"id": string,"registro_id": string | null,"tabla_afectada": string,"usuario_externo_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": Database["public"]['Enums']["accion_bitacora"],"creado_en"?: string,"empleado_id"?: string | null,"id"?: string,"registro_id"?: string | null,"tabla_afectada": string,"usuario_externo_id"?: string | null
                  }
                  Update: {
                    "accion"?: Database["public"]['Enums']["accion_bitacora"],"creado_en"?: string,"empleado_id"?: string | null,"id"?: string,"registro_id"?: string | null,"tabla_afectada"?: string,"usuario_externo_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bitacora_acceso_empleado_id_fkey"
      columns: ["empleado_id"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bitacora_acceso_usuario_externo_id_fkey"
      columns: ["usuario_externo_id"]
isOneToOne: false
      referencedRelation: "usuario_externo"
      referencedColumns: ["id"]
    }
                  ]
                },"cat_area": {
                  Row: {
                    "clave": string,"id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"id"?: never,"nombre": string
                  }
                  Update: {
                    "clave"?: string,"id"?: never,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cat_asentamiento": {
                  Row: {
                    "codigo_postal": string,"estado": string,"id": number,"latitud": number | null,"localidad": string | null,"longitud": number | null,"municipio": string,"nombre": string,"tipo_asentamiento": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo_postal": string,"estado": string,"id"?: never,"latitud"?: number | null,"localidad"?: string | null,"longitud"?: number | null,"municipio": string,"nombre": string,"tipo_asentamiento": string
                  }
                  Update: {
                    "codigo_postal"?: string,"estado"?: string,"id"?: never,"latitud"?: number | null,"localidad"?: string | null,"longitud"?: number | null,"municipio"?: string,"nombre"?: string,"tipo_asentamiento"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cat_ocupacion": {
                  Row: {
                    "clave": string,"id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"id"?: never,"nombre": string
                  }
                  Update: {
                    "clave"?: string,"id"?: never,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cat_parentesco": {
                  Row: {
                    "clave": string,"id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"id"?: never,"nombre": string
                  }
                  Update: {
                    "clave"?: string,"id"?: never,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cat_tipo_actividad": {
                  Row: {
                    "clave": string,"id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"id"?: never,"nombre": string
                  }
                  Update: {
                    "clave"?: string,"id"?: never,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cat_tipo_atencion": {
                  Row: {
                    "area_id": number,"clave": string,"id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": number,"clave": string,"id"?: never,"nombre": string
                  }
                  Update: {
                    "area_id"?: number,"clave"?: string,"id"?: never,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cat_tipo_atencion_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    }
                  ]
                },"cat_tipo_documento": {
                  Row: {
                    "clave": string,"id": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"id"?: never,"nombre": string
                  }
                  Update: {
                    "clave"?: string,"id"?: never,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cita": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"area_id": number,"confirmada_en": string | null,"creado_en": string,"creado_por": string | null,"estado": Database["public"]['Enums']["estado_cita"],"id": string,"motivo_cancelacion": string | null,"origen": Database["public"]['Enums']["origen_cita"],"persona_id": string,"prioridad": Database["public"]['Enums']["prioridad_nivel"] | null,"programada_en": string,"reagendada_de": string | null,"recomendada_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_id": number,"confirmada_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"estado"?: Database["public"]['Enums']["estado_cita"],"id"?: string,"motivo_cancelacion"?: string | null,"origen"?: Database["public"]['Enums']["origen_cita"],"persona_id": string,"prioridad"?: Database["public"]['Enums']["prioridad_nivel"] | null,"programada_en": string,"reagendada_de"?: string | null,"recomendada_por"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_id"?: number,"confirmada_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"estado"?: Database["public"]['Enums']["estado_cita"],"id"?: string,"motivo_cancelacion"?: string | null,"origen"?: Database["public"]['Enums']["origen_cita"],"persona_id"?: string,"prioridad"?: Database["public"]['Enums']["prioridad_nivel"] | null,"programada_en"?: string,"reagendada_de"?: string | null,"recomendada_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cita_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cita_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cita_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "persona"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cita_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["persona_id"]
    },{
      foreignKeyName: "cita_reagendada_de_fkey"
      columns: ["reagendada_de"]
isOneToOne: true
      referencedRelation: "cita"
      referencedColumns: ["id"]
    }
                  ]
                },"derivacion": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"area_destino_id": number | null,"area_origen_id": number | null,"creado_en": string,"creado_por": string | null,"destino": Database["public"]['Enums']["destino_derivacion"],"estado": Database["public"]['Enums']["estado_derivacion"],"fecha_derivacion": string,"ficha_id": string,"id": string,"institucion_id": number | null,"institucion_otra": string | null,"motivo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_destino_id"?: number | null,"area_origen_id"?: number | null,"creado_en"?: string,"creado_por"?: string | null,"destino": Database["public"]['Enums']["destino_derivacion"],"estado"?: Database["public"]['Enums']["estado_derivacion"],"fecha_derivacion"?: string,"ficha_id": string,"id"?: string,"institucion_id"?: number | null,"institucion_otra"?: string | null,"motivo"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_destino_id"?: number | null,"area_origen_id"?: number | null,"creado_en"?: string,"creado_por"?: string | null,"destino"?: Database["public"]['Enums']["destino_derivacion"],"estado"?: Database["public"]['Enums']["estado_derivacion"],"fecha_derivacion"?: string,"ficha_id"?: string,"id"?: string,"institucion_id"?: number | null,"institucion_otra"?: string | null,"motivo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "derivacion_area_destino_id_fkey"
      columns: ["area_destino_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "derivacion_area_origen_id_fkey"
      columns: ["area_origen_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "derivacion_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "derivacion_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "derivacion_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    },{
      foreignKeyName: "derivacion_institucion_id_fkey"
      columns: ["institucion_id"]
isOneToOne: false
      referencedRelation: "directorio_institucion"
      referencedColumns: ["id"]
    }
                  ]
                },"directorio_institucion": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"asentamiento_id": number | null,"calle": string | null,"categoria": Database["public"]['Enums']["categoria_institucion"],"codigo_postal": string | null,"creado_en": string,"creado_por": string | null,"es_24_horas": boolean,"horario": string | null,"id": number,"nombre": string,"numero_exterior": string | null,"numero_interior": string | null,"orden": number,"referencias": string | null,"telefono": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"calle"?: string | null,"categoria": Database["public"]['Enums']["categoria_institucion"],"codigo_postal"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"es_24_horas"?: boolean,"horario"?: string | null,"id"?: never,"nombre": string,"numero_exterior"?: string | null,"numero_interior"?: string | null,"orden"?: number,"referencias"?: string | null,"telefono": string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"calle"?: string | null,"categoria"?: Database["public"]['Enums']["categoria_institucion"],"codigo_postal"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"es_24_horas"?: boolean,"horario"?: string | null,"id"?: never,"nombre"?: string,"numero_exterior"?: string | null,"numero_interior"?: string | null,"orden"?: number,"referencias"?: string | null,"telefono"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "directorio_institucion_asentamiento_id_fkey"
      columns: ["asentamiento_id"]
isOneToOne: false
      referencedRelation: "cat_asentamiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "directorio_institucion_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    }
                  ]
                },"documento": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"creado_en": string,"creado_por": string | null,"descripcion": string | null,"ficha_id": string,"id": string,"nombre_archivo": string,"orden_proteccion_id": string | null,"ruta_storage": string,"tipo_documento_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"ficha_id": string,"id"?: string,"nombre_archivo": string,"orden_proteccion_id"?: string | null,"ruta_storage": string,"tipo_documento_id": number
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"ficha_id"?: string,"id"?: string,"nombre_archivo"?: string,"orden_proteccion_id"?: string | null,"ruta_storage"?: string,"tipo_documento_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "documento_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documento_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documento_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    },{
      foreignKeyName: "documento_orden_proteccion_id_ficha_id_fkey"
      columns: ["orden_proteccion_id","ficha_id"]
isOneToOne: false
      referencedRelation: "orden_proteccion"
      referencedColumns: ["id","ficha_id"]
    },{
      foreignKeyName: "documento_tipo_documento_id_fkey"
      columns: ["tipo_documento_id"]
isOneToOne: false
      referencedRelation: "cat_tipo_documento"
      referencedColumns: ["id"]
    }
                  ]
                },"domicilio": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"asentamiento_id": number | null,"calle": string | null,"codigo_postal": string | null,"creado_en": string,"creado_por": string | null,"es_actual": boolean,"id": string,"numero_exterior": string | null,"numero_interior": string | null,"persona_id": string,"referencias": string | null,"zona": Database["public"]['Enums']["zona_geografica"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"calle"?: string | null,"codigo_postal"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"es_actual"?: boolean,"id"?: string,"numero_exterior"?: string | null,"numero_interior"?: string | null,"persona_id": string,"referencias"?: string | null,"zona"?: Database["public"]['Enums']["zona_geografica"] | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"asentamiento_id"?: number | null,"calle"?: string | null,"codigo_postal"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"es_actual"?: boolean,"id"?: string,"numero_exterior"?: string | null,"numero_interior"?: string | null,"persona_id"?: string,"referencias"?: string | null,"zona"?: Database["public"]['Enums']["zona_geografica"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "domicilio_asentamiento_id_fkey"
      columns: ["asentamiento_id"]
isOneToOne: false
      referencedRelation: "cat_asentamiento"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "domicilio_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "domicilio_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "persona"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "domicilio_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["persona_id"]
    }
                  ]
                },"empleado": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"area_id": number | null,"creado_en": string,"creado_por": string | null,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_empleado"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_id"?: number | null,"creado_en"?: string,"creado_por"?: string | null,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_empleado"]
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_id"?: number | null,"creado_en"?: string,"creado_por"?: string | null,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_empleado"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "empleado_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "empleado_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    }
                  ]
                },"estudio_socioeconomico": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"bienes": (Database["public"]['Enums']["bien_vivienda"])[] | null,"creado_en": string,"creado_por": string | null,"es_actual": boolean,"especificacion_apoyo": string | null,"fecha_estudio": string,"ficha_id": string,"id": string,"ingreso_mensual_propio": number | null,"material": Database["public"]['Enums']["material_vivienda"] | null,"material_otro": string | null,"numero_dependientes": number | null,"servicios": (Database["public"]['Enums']["servicio_vivienda"])[] | null,"tiene_apoyo": boolean,"tipo_vivienda": Database["public"]['Enums']["tipo_vivienda"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"bienes"?: (Database["public"]['Enums']["bien_vivienda"])[] | null,"creado_en"?: string,"creado_por"?: string | null,"es_actual"?: boolean,"especificacion_apoyo"?: string | null,"fecha_estudio"?: string,"ficha_id": string,"id"?: string,"ingreso_mensual_propio"?: number | null,"material"?: Database["public"]['Enums']["material_vivienda"] | null,"material_otro"?: string | null,"numero_dependientes"?: number | null,"servicios"?: (Database["public"]['Enums']["servicio_vivienda"])[] | null,"tiene_apoyo"?: boolean,"tipo_vivienda"?: Database["public"]['Enums']["tipo_vivienda"] | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"bienes"?: (Database["public"]['Enums']["bien_vivienda"])[] | null,"creado_en"?: string,"creado_por"?: string | null,"es_actual"?: boolean,"especificacion_apoyo"?: string | null,"fecha_estudio"?: string,"ficha_id"?: string,"id"?: string,"ingreso_mensual_propio"?: number | null,"material"?: Database["public"]['Enums']["material_vivienda"] | null,"material_otro"?: string | null,"numero_dependientes"?: number | null,"servicios"?: (Database["public"]['Enums']["servicio_vivienda"])[] | null,"tiene_apoyo"?: boolean,"tipo_vivienda"?: Database["public"]['Enums']["tipo_vivienda"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "estudio_socioeconomico_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estudio_socioeconomico_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estudio_socioeconomico_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    }
                  ]
                },"ficha_registro": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"aviso_privacidad_aceptado_en": string,"creado_en": string,"creado_por": string | null,"drogas": (Database["public"]['Enums']["tipo_droga"])[] | null,"es_victima_delito": boolean | null,"especificacion_droga": string | null,"estado": Database["public"]['Enums']["estado_ficha"],"estado_civil": Database["public"]['Enums']["estado_civil"] | null,"folio": string,"id": string,"numero_hijas": number | null,"numero_hijos_hombres": number | null,"ocupacion_id": number | null,"ocupacion_otra": string | null,"persona_id": string,"registrada_en": string,"servicio_medico": Database["public"]['Enums']["servicio_medico"] | null,"servicio_medico_otro": string | null,"tiene_consumo_alcohol": boolean | null,"tiene_consumo_droga": boolean | null,"tiene_denuncia": boolean | null,"tiene_embarazo": boolean | null,"tiene_trabajo": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"aviso_privacidad_aceptado_en": string,"creado_en"?: string,"creado_por"?: string | null,"drogas"?: (Database["public"]['Enums']["tipo_droga"])[] | null,"es_victima_delito"?: boolean | null,"especificacion_droga"?: string | null,"estado"?: Database["public"]['Enums']["estado_ficha"],"estado_civil"?: Database["public"]['Enums']["estado_civil"] | null,"folio"?: string,"id"?: string,"numero_hijas"?: number | null,"numero_hijos_hombres"?: number | null,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"persona_id": string,"registrada_en"?: string,"servicio_medico"?: Database["public"]['Enums']["servicio_medico"] | null,"servicio_medico_otro"?: string | null,"tiene_consumo_alcohol"?: boolean | null,"tiene_consumo_droga"?: boolean | null,"tiene_denuncia"?: boolean | null,"tiene_embarazo"?: boolean | null,"tiene_trabajo"?: boolean | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"aviso_privacidad_aceptado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"drogas"?: (Database["public"]['Enums']["tipo_droga"])[] | null,"es_victima_delito"?: boolean | null,"especificacion_droga"?: string | null,"estado"?: Database["public"]['Enums']["estado_ficha"],"estado_civil"?: Database["public"]['Enums']["estado_civil"] | null,"folio"?: string,"id"?: string,"numero_hijas"?: number | null,"numero_hijos_hombres"?: number | null,"ocupacion_id"?: number | null,"ocupacion_otra"?: string | null,"persona_id"?: string,"registrada_en"?: string,"servicio_medico"?: Database["public"]['Enums']["servicio_medico"] | null,"servicio_medico_otro"?: string | null,"tiene_consumo_alcohol"?: boolean | null,"tiene_consumo_droga"?: boolean | null,"tiene_denuncia"?: boolean | null,"tiene_embarazo"?: boolean | null,"tiene_trabajo"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ficha_registro_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ficha_registro_ocupacion_id_fkey"
      columns: ["ocupacion_id"]
isOneToOne: false
      referencedRelation: "cat_ocupacion"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ficha_registro_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: true
      referencedRelation: "persona"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ficha_registro_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: true
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["persona_id"]
    }
                  ]
                },"ficha_servicio_solicitado": {
                  Row: {
                    "area_id": number,"creado_en": string,"creado_por": string | null,"ficha_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": number,"creado_en"?: string,"creado_por"?: string | null,"ficha_id": string
                  }
                  Update: {
                    "area_id"?: number,"creado_en"?: string,"creado_por"?: string | null,"ficha_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ficha_servicio_solicitado_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ficha_servicio_solicitado_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ficha_servicio_solicitado_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ficha_servicio_solicitado_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    }
                  ]
                },"historial_clinico": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"antecedentes_familiares": string | null,"antecedentes_personales": string | null,"creado_en": string,"creado_por": string | null,"ficha_id": string,"id": string,"motivo_consulta": string | null,"observaciones_iniciales": string | null,"tiene_atencion_psicologica_previa": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"antecedentes_familiares"?: string | null,"antecedentes_personales"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"ficha_id": string,"id"?: string,"motivo_consulta"?: string | null,"observaciones_iniciales"?: string | null,"tiene_atencion_psicologica_previa"?: boolean | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"antecedentes_familiares"?: string | null,"antecedentes_personales"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"ficha_id"?: string,"id"?: string,"motivo_consulta"?: string | null,"observaciones_iniciales"?: string | null,"tiene_atencion_psicologica_previa"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "historial_clinico_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "historial_clinico_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: true
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "historial_clinico_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: true
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    }
                  ]
                },"nota_area": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"area_id": number,"contenido": string,"creado_en": string,"creado_por": string | null,"ficha_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_id": number,"contenido": string,"creado_en"?: string,"creado_por"?: string | null,"ficha_id": string,"id"?: string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"area_id"?: number,"contenido"?: string,"creado_en"?: string,"creado_por"?: string | null,"ficha_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nota_area_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "cat_area"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nota_area_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nota_area_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nota_area_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    }
                  ]
                },"orden_proteccion": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"agresor_id": string | null,"autoridad_emisora": string | null,"creado_en": string,"creado_por": string | null,"estado": Database["public"]['Enums']["estado_orden_proteccion"],"fecha_emision": string,"fecha_vigencia": string | null,"ficha_id": string,"id": string,"numero_oficio": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"agresor_id"?: string | null,"autoridad_emisora"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"estado"?: Database["public"]['Enums']["estado_orden_proteccion"],"fecha_emision": string,"fecha_vigencia"?: string | null,"ficha_id": string,"id"?: string,"numero_oficio"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"agresor_id"?: string | null,"autoridad_emisora"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"estado"?: Database["public"]['Enums']["estado_orden_proteccion"],"fecha_emision"?: string,"fecha_vigencia"?: string | null,"ficha_id"?: string,"id"?: string,"numero_oficio"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orden_proteccion_agresor_id_ficha_id_fkey"
      columns: ["agresor_id","ficha_id"]
isOneToOne: false
      referencedRelation: "agresor"
      referencedColumns: ["id","ficha_id"]
    },{
      foreignKeyName: "orden_proteccion_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orden_proteccion_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "ficha_registro"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orden_proteccion_ficha_id_fkey"
      columns: ["ficha_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["ficha_id"]
    }
                  ]
                },"persona": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"apellido_materno": string | null,"apellido_paterno": string,"celular": string | null,"creado_en": string,"creado_por": string | null,"curp": string,"discapacidad": string | null,"entidad_nacimiento": string,"escolaridad": Database["public"]['Enums']["escolaridad_nivel"] | null,"fecha_nacimiento": string,"grupo_etnico": string | null,"id": string,"nombres": string,"religion": string | null,"sexo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"apellido_materno"?: string | null,"apellido_paterno": string,"celular"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"curp": string,"discapacidad"?: string | null,"entidad_nacimiento"?: never,"escolaridad"?: Database["public"]['Enums']["escolaridad_nivel"] | null,"fecha_nacimiento"?: never,"grupo_etnico"?: string | null,"id"?: string,"nombres": string,"religion"?: string | null,"sexo"?: never
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"apellido_materno"?: string | null,"apellido_paterno"?: string,"celular"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"curp"?: string,"discapacidad"?: string | null,"entidad_nacimiento"?: never,"escolaridad"?: Database["public"]['Enums']["escolaridad_nivel"] | null,"fecha_nacimiento"?: never,"grupo_etnico"?: string | null,"id"?: string,"nombres"?: string,"religion"?: string | null,"sexo"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "persona_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    }
                  ]
                },"pre_registro": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"apellido_materno": string | null,"apellido_paterno": string,"auth_user_id": string,"aviso_privacidad_aceptado_en": string,"celular": string | null,"creado_en": string,"curp": string,"entidad_nacimiento": string,"estado": string,"fecha_nacimiento": string,"id": string,"nombres": string,"persona_id": string | null,"sexo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"apellido_materno"?: string | null,"apellido_paterno": string,"auth_user_id": string,"aviso_privacidad_aceptado_en": string,"celular"?: string | null,"creado_en"?: string,"curp": string,"entidad_nacimiento"?: never,"estado"?: string,"fecha_nacimiento"?: never,"id"?: string,"nombres": string,"persona_id"?: string | null,"sexo"?: never
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"apellido_materno"?: string | null,"apellido_paterno"?: string,"auth_user_id"?: string,"aviso_privacidad_aceptado_en"?: string,"celular"?: string | null,"creado_en"?: string,"curp"?: string,"entidad_nacimiento"?: never,"estado"?: string,"fecha_nacimiento"?: never,"id"?: string,"nombres"?: string,"persona_id"?: string | null,"sexo"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "pre_registro_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "persona"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pre_registro_persona_id_fkey"
      columns: ["persona_id"]
isOneToOne: false
      referencedRelation: "vista_lista_urgencias"
      referencedColumns: ["persona_id"]
    }
                  ]
                },"usuario_externo": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"creado_en": string,"creado_por": string | null,"dependencia": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"dependencia"?: string,"id": string,"nombre": string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"dependencia"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_externo_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "empleado"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "vista_informe_anual": {
                  Row: {
                    "anio": number | null,"area": string,"hombres": number | null,"mujeres": number | null,"primera_vez_o_seguimiento": string | null,"tipo_atencion": string,"total_atenciones": number | null,"total_personas": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"vista_informe_mensual": {
                  Row: {
                    "anio": number | null,"area": string,"hombres": number | null,"mes": number | null,"mujeres": number | null,"primera_vez_o_seguimiento": string | null,"tipo_atencion": string,"total_atenciones": number | null,"total_personas": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"vista_lista_urgencias": {
                  Row: {
                    "apellido_materno": string | null,"apellido_paterno": string,"celular": string | null,"fecha_ultima_prioridad": string | null,"ficha_id": string,"folio": string,"nombres": string,"persona_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "area_id_por_clave":
{ Args: { "p_clave": string }; Returns: number
                           },
"auth_area_id":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"auth_rol":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["rol_empleado"]
                           },
"buscar_pre_registro_por_curp":
{ Args: { "p_curp": string }; Returns: {
              "apellido_materno": string,"apellido_paterno": string,"celular": string,"curp": string,"entidad_nacimiento": string,"fecha_nacimiento": string,"nombres": string,"persona_id": string,"pre_registro_id": string,"sexo": string
            }[]
                           },
"cambiar_estado_cita":
{ Args: { "p_cita_id": string,"p_estado": Database["public"]['Enums']["estado_cita"],"p_motivo"?: string }; Returns: {
              "cita_id": string,"confirmada_en": string,"estado": Database["public"]['Enums']["estado_cita"]
            }[]
                           },
"cambiar_estado_derivacion":
{ Args: { "p_derivacion_id": string,"p_estado": Database["public"]['Enums']["estado_derivacion"] }; Returns: {
              "actualizado_en": string,"derivacion_id": string,"estado": Database["public"]['Enums']["estado_derivacion"]
            }[]
                           },
"crear_ficha_completa":
{ Args: { "p_payload": Json }; Returns: {
              "ficha_id": string,"folio": string,"persona_id": string
            }[]
                           },
"es_area_atencion":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_direccion":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_empleado_activo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_linea_24_7":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_umeca":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"generar_folio_ficha":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_agenda":
{ Args: { "p_area_id"?: number,"p_desde": string,"p_estados"?: (Database["public"]['Enums']["estado_cita"])[],"p_hasta": string,"p_limite"?: number }; Returns: {
              "area_clave": string,"area_id": number,"celular": string,"cita_id": string,"estado": Database["public"]['Enums']["estado_cita"],"nombre_completo": string,"origen": Database["public"]['Enums']["origen_cita"],"persona_id": string,"prioridad": Database["public"]['Enums']["prioridad_nivel"],"programada_en": string,"reagendada_de": string,"recomendada_por": string
            }[]
                           },
"get_derivaciones":
{ Args: { "p_estado"?: Database["public"]['Enums']["estado_derivacion"],"p_ficha_id"?: string,"p_limite"?: number }; Returns: {
              "area_destino_id": number,"area_destino_nombre": string,"area_origen_id": number,"area_origen_nombre": string,"creado_en": string,"destino": Database["public"]['Enums']["destino_derivacion"],"estado": Database["public"]['Enums']["estado_derivacion"],"fecha_derivacion": string,"ficha_id": string,"folio": string,"id": string,"institucion_id": number,"institucion_nombre": string,"institucion_otra": string,"motivo": string,"usuaria_nombre": string
            }[]
                           },
"get_mapa_calor_asentamiento":
{ Args: { "p_umbral_minimo"?: number }; Returns: {
              "asentamiento_id": number,"codigo_postal": string,"estado": string,"latitud": number,"longitud": number,"municipio": string,"nombre": string,"tipo_asentamiento": string,"total_actividades": number,"total_alertas": number,"total_expedientes": number
            }[]
                           },
"get_umeca_citas":
{ Args: Record<PropertyKey, never>; Returns: {
              "apellido_materno": string,"apellido_paterno": string,"cita_id": string,"estado": string,"nombres": string,"programada_en": string
            }[]
                           },
"registrar_consulta":
{ Args: { "p_registro_id": string,"p_tabla": string }; Returns: undefined
                           },
"tiene_orden_vigente":
{ Args: { "p_persona_id": string }; Returns: boolean
                           },
"tiene_permiso":
{ Args: { "p_permiso": string }; Returns: boolean
                           }
          }
          Enums: {
            "accion_bitacora": "ver"|"crear"|"actualizar"|"desactivar","bien_vivienda": "estufa"|"refrigerador"|"lavadora"|"aire_acondicionado"|"abanico"|"tv"|"microondas"|"computadora","categoria_institucion": "emergencia"|"denuncia"|"orientacion_legal"|"atencion_psicologica"|"trabajo_social"|"refugio"|"salud"|"linea_apoyo","destino_derivacion": "trabajo_social"|"psicologia"|"juridico"|"fiscalia"|"refugio"|"capacitacion"|"otra_institucion","escolaridad_nivel": "ninguna"|"primaria"|"secundaria"|"preparatoria"|"carrera"|"otros_estudios","estado_alerta": "nueva"|"tomada"|"atendida","estado_cita": "agendada"|"confirmada"|"cancelada"|"reagendada"|"asistio"|"no_asistio","estado_civil": "soltero"|"casado"|"union_libre"|"separado"|"divorciado"|"viudo","estado_derivacion": "pendiente"|"en_proceso"|"concluida"|"cancelada","estado_ficha": "abierto"|"en_seguimiento"|"cerrado"|"archivado","estado_orden_proteccion": "vigente"|"vencida"|"cancelada"|"en_tramite","frecuencia_ingreso": "diario"|"semanal"|"quincenal"|"mensual"|"variable","material_vivienda": "ladrillo"|"lamina"|"block"|"madera"|"carton"|"otro","nivel_educativo": "primaria"|"secundaria"|"preparatoria"|"universidad","origen_alerta": "app_movil"|"telefono"|"presencial","origen_cita": "regular"|"umeca","prioridad_nivel": "alta"|"media"|"baja","rol_empleado": "titular"|"subdireccion"|"trabajo_social"|"psicologia"|"juridico"|"recepcion","servicio_medico": "ninguno"|"imss"|"issste"|"imss_bienestar"|"particular"|"otro","servicio_vivienda": "agua"|"drenaje"|"luz"|"pavimento"|"cable"|"internet","sexo_biologico": "H"|"M","tipo_droga": "marihuana"|"cristal"|"cocaina"|"inhalantes"|"medicamento_controlado"|"otra","tipo_institucion_actividad": "escuela"|"empresa_privada"|"sector_publico"|"comunidad"|"otro","tipo_trabajo": "fijo"|"temporal"|"negocio_propio","tipo_vivienda": "propia"|"hipotecada"|"rentada"|"invasion"|"infonavit"|"prestada","zona_geografica": "urbana"|"rural"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "accion_bitacora": ["ver", "crear", "actualizar", "desactivar"],"bien_vivienda": ["estufa", "refrigerador", "lavadora", "aire_acondicionado", "abanico", "tv", "microondas", "computadora"],"categoria_institucion": ["emergencia", "denuncia", "orientacion_legal", "atencion_psicologica", "trabajo_social", "refugio", "salud", "linea_apoyo"],"destino_derivacion": ["trabajo_social", "psicologia", "juridico", "fiscalia", "refugio", "capacitacion", "otra_institucion"],"escolaridad_nivel": ["ninguna", "primaria", "secundaria", "preparatoria", "carrera", "otros_estudios"],"estado_alerta": ["nueva", "tomada", "atendida"],"estado_cita": ["agendada", "confirmada", "cancelada", "reagendada", "asistio", "no_asistio"],"estado_civil": ["soltero", "casado", "union_libre", "separado", "divorciado", "viudo"],"estado_derivacion": ["pendiente", "en_proceso", "concluida", "cancelada"],"estado_ficha": ["abierto", "en_seguimiento", "cerrado", "archivado"],"estado_orden_proteccion": ["vigente", "vencida", "cancelada", "en_tramite"],"frecuencia_ingreso": ["diario", "semanal", "quincenal", "mensual", "variable"],"material_vivienda": ["ladrillo", "lamina", "block", "madera", "carton", "otro"],"nivel_educativo": ["primaria", "secundaria", "preparatoria", "universidad"],"origen_alerta": ["app_movil", "telefono", "presencial"],"origen_cita": ["regular", "umeca"],"prioridad_nivel": ["alta", "media", "baja"],"rol_empleado": ["titular", "subdireccion", "trabajo_social", "psicologia", "juridico", "recepcion"],"servicio_medico": ["ninguno", "imss", "issste", "imss_bienestar", "particular", "otro"],"servicio_vivienda": ["agua", "drenaje", "luz", "pavimento", "cable", "internet"],"sexo_biologico": ["H", "M"],"tipo_droga": ["marihuana", "cristal", "cocaina", "inhalantes", "medicamento_controlado", "otra"],"tipo_institucion_actividad": ["escuela", "empresa_privada", "sector_publico", "comunidad", "otro"],"tipo_trabajo": ["fijo", "temporal", "negocio_propio"],"tipo_vivienda": ["propia", "hipotecada", "rentada", "invasion", "infonavit", "prestada"],"zona_geografica": ["urbana", "rural"]
          }
        }
} as const
