import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Trunkline from './trunkline.model.js'

const PredRes = sequelize.define('pred_res', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    pred_res_id: {
        type: DataTypes.STRING(15),
        allowNull: false
    },
    tline_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
            model: Trunkline,
            key: 'tline_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    drop_index: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    google_maps_link: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    final_estimate: {
        type: DataTypes.DOUBLE,
        allowNull: false
    },
    estimate_std: {
        type: DataTypes.DOUBLE,
        allowNull: false
    },
    confidence: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    method_estimates: {
        type: DataTypes.JSON,
        allowNull: false
    },
    method_weights: {
        type: DataTypes.JSON,
        allowNull: false
    },
    gradients: {
        type: DataTypes.JSON,
        allowNull: false
    },
    regions: {
        type: DataTypes.JSON,
        allowNull: false
    },
    hgl_fit: {
        type: DataTypes.JSON,
        allowNull: true
    },
    sensors: {
        type: DataTypes.JSON,
        allowNull: false
    },
    is_saved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'pred_res',
    timestamps: false,
    underscored: true
})

export default PredRes
