const defineAssociations = models => {
    // User -> Field
    models.User.belongsTo(models.Field, {
        foreignKey: 'field_id',
        targetKey: 'field_id',
        as: 'field'
    })
    models.Field.hasMany(models.User, {
        foreignKey: 'field_id',
        sourceKey: 'field_id',
        as: 'users'
    })


    // Field -> Trunkline
    models.Field.hasMany(models.Trunkline, {
        foreignKey: 'field_id',
        sourceKey: 'field_id',
        as: 'trunklines'
    })
    models.Trunkline.belongsTo(models.Field, {
        foreignKey: 'field_id',
        targetKey: 'field_id',
        as: 'field'
    })


    // Trunkline -> Spot
    models.Trunkline.hasMany(models.Spot, {
        foreignKey: 'tline_id',
        sourceKey: 'tline_id',
        as: 'spots'
    })
    models.Spot.belongsTo(models.Trunkline, {
        foreignKey: 'tline_id',
        targetKey: 'tline_id',
        as: 'trunkline'
    })

    // Trunkline -> PredValue
    models.Trunkline.hasOne(models.PredValue, {
        foreignKey: 'tline_id',
        sourceKey:  'tline_id',
        as:         'pred_value'
    })
    models.PredValue.belongsTo(models.Trunkline, {
        foreignKey: 'tline_id',
        targetKey:  'tline_id',
        as:         'trunkline'
    })

    // Trunkline -> Models
    // models.Trunkline.hasMany(models.TrainingModels, {
    //     foreignKey: 'id_tline',
    //     sourceKey: 'tline_id',
    //     as: 'models'
    // })
    // models.TrainingModels.belongsTo(models.Trunkline, {
    //     foreignKey: 'id_tline',
    //     targetKey: 'tline_id',
    //     as: 'trunkline'
    // })

    // Spot -> PredValue
    models.Spot.hasOne(models.PredValue, {
        foreignKey: 'spot_id',
        sourceKey:  'spot_id',
        as:         'pred_value'
    })
    models.PredValue.belongsTo(models.Spot, {
        foreignKey: 'spot_id',
        targetKey:  'spot_id',
        as:         'spot'
    })

    // Trunkline -> ML
    models.Trunkline.hasMany(models.ML, {
        foreignKey: 'tline_id',
        sourceKey: 'tline_id',
        as: 'mls'
    })
    models.ML.belongsTo(models.Trunkline, {
        foreignKey: 'tline_id',
        targetKey: 'tline_id',
        as: 'trunkline'
    })

    // Pressure -> Spot
    // models.Pressure.belongsTo(models.Spot, {
    //     foreignKey: 'spot_id',
    //     targetKey: 'spot_id',
    //     as: 'spot'
    // })

    // models.Spot.hasMany(models.Pressure, {
    //     foreignKey: 'spot_id',
    //     sourceKey: 'spot_id',
    //     as: 'pressures'
    // })
}

export default defineAssociations
